/**
 * Daily deep probe (v0.7.79, owner request). The 60s health sweep only pings
 * `/models` — a station can pass that while its actual model pool is dead
 * ("No active API keys for this group"-style 503s). So once a day, at a RANDOM
 * time per station, we send a REAL question (never a hello-ping) to ONE random
 * enabled model of that station:
 *
 *   - success → health_status 'healthy'
 *   - failure → health_status 'unhealthy' (router then deprioritizes it)
 *   - either way the attempt is usage-logged (kind 'other') so it shows in 使用日志
 *
 * The probe calls the station DIRECTLY (bare chat/completions fetch) — the
 * normal invokeModel failover would defeat the point by silently trying other
 * stations. `stations.last_deep_probe` (migration v16) remembers the last
 * probe day so restarts don't double-probe; the random fire time lives in
 * memory and is re-rolled each day.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { decryptSecret } from '../utils/crypto';
import { logApiUsage } from './usageLog';
import { normalizeModelName } from './normalizeModelName';
import { getErrorMessage } from '../utils/errors';

const PROBE_TIMEOUT_MS = 90_000;
const CHECK_EVERY_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Real questions — meaningful generation, short enough to stay cheap. */
export const PROBE_QUESTIONS = [
  '请告诉我 AI 和 LLM 的区别是什么？',
  '用一句话解释什么是机器学习。',
  '请简要说明 Transformer 和 RNN 的主要区别。',
  '什么是提示词工程（prompt engineering）？请举一个例子。',
  '请解释什么是模型的上下文窗口（context window）。',
  '简要说明监督学习和无监督学习的区别。',
  '什么是 RAG（检索增强生成）？它解决什么问题？',
  '请用通俗的话解释什么是向量嵌入（embedding）。',
] as const;

export type Rng = () => number;

/** A random ms-timestamp inside the day that starts at dayStartMs. Pure. */
export function pickDailyProbeTime(dayStartMs: number, rng: Rng = Math.random): number {
  return dayStartMs + Math.floor(rng() * DAY_MS);
}

/** Local YYYY-MM-DD of a timestamp/ISO string (probe-day identity). */
export function probeDay(input: number | string): string {
  const d = typeof input === 'number' ? new Date(input) : new Date(input);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Is this station due? (past its scheduled time AND not yet probed today) Pure. */
export function dueForProbe(
  lastDeepProbe: string | null,
  scheduledAtMs: number,
  nowMs: number
): boolean {
  if (nowMs < scheduledAtMs) return false;
  if (!lastDeepProbe) return true;
  return probeDay(lastDeepProbe) !== probeDay(nowMs);
}

export interface DeepProbeDeps {
  fetchImpl?: typeof fetch;
  log?: typeof logApiUsage;
  rng?: Rng;
}

export type DeepProbeResult =
  | { ok: true; model: string; question: string; latencyMs: number }
  | { ok: false; reason: string };

/**
 * Probe one station now: random enabled model × random real question, sent
 * straight to the station's chat/completions. Persists health_status +
 * last_deep_probe and logs the attempt. Never throws.
 */
export async function runDeepProbe(
  stationId: string,
  db: Database.Database = getDb(),
  deps: DeepProbeDeps = {}
): Promise<DeepProbeResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const log = deps.log ?? logApiUsage;
  const rng = deps.rng ?? Math.random;
  const now = new Date().toISOString();

  try {
    const station = db
      .prepare('SELECT id, name, base_url, api_key FROM stations WHERE id = ? AND enabled = 1')
      .get(stationId) as { id: string; name: string; base_url: string; api_key: string } | undefined;
    if (!station) return { ok: false, reason: 'station_not_found_or_disabled' };

    const models = db
      .prepare('SELECT model_id FROM station_models WHERE station_id = ? AND enabled = 1')
      .all(stationId) as { model_id: string }[];
    if (models.length === 0) {
      // Nothing to probe — do not flip health, just stamp the day so we don't retry all day.
      db.prepare('UPDATE stations SET last_deep_probe = ? WHERE id = ?').run(now, stationId);
      return { ok: false, reason: 'no_enabled_models' };
    }

    const model = models[Math.floor(rng() * models.length)].model_id;
    const question = PROBE_QUESTIONS[Math.floor(rng() * PROBE_QUESTIONS.length)];
    const baseUrl = station.base_url.replace(/\/+$/, '');
    const started = Date.now();

    let healthy = false;
    let detail = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } = {};
    try {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${decryptSecret(station.api_key)}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: question }],
          max_tokens: 300,
          temperature: 0.3,
          stream: false,
        }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) {
        detail = `HTTP ${res.status}`;
      } else {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>;
          usage?: typeof usage;
        };
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim().length > 0) {
          healthy = true;
          usage = data.usage || {};
        } else {
          detail = 'empty_completion';
        }
      }
    } catch (err) {
      detail = (err as Error)?.name === 'TimeoutError' ? 'Timeout' : getErrorMessage(err);
    }
    const latencyMs = Date.now() - started;

    db.prepare(
      'UPDATE stations SET health_status = ?, last_health_check = ?, last_deep_probe = ?, updated_at = ? WHERE id = ?'
    ).run(healthy ? 'healthy' : 'unhealthy', now, now, now, stationId);

    log({
      userId: null,
      kind: 'other',
      modelNormalized: normalizeModelName(model),
      modelUsed: model,
      stationId: station.id,
      stationName: station.name,
      status: healthy ? 'ok' : 'error',
      errorMessage: healthy ? null : `[deep-probe] ${detail}`,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      latencyMs,
    });

    console.log(
      `🔎 Deep probe ${station.name} × ${model}: ${healthy ? 'healthy' : `UNHEALTHY (${detail})`} (${latencyMs}ms)`
    );
    return healthy ? { ok: true, model, question, latencyMs } : { ok: false, reason: detail };
  } catch (err) {
    console.warn(`[deep-probe] failed for ${stationId}: ${getErrorMessage(err)}`);
    return { ok: false, reason: getErrorMessage(err) };
  }
}

// ---------------------------------------------------------------------------
// Scheduler: every minute, fire any enabled station whose random time is due.
// ---------------------------------------------------------------------------

let timer: ReturnType<typeof setInterval> | null = null;
/** stationId → { day, atMs } — the random fire time rolled for that local day. */
const schedule = new Map<string, { day: string; atMs: number }>();

function scheduledTimeFor(stationId: string, nowMs: number, rng: Rng): number {
  const today = probeDay(nowMs);
  const existing = schedule.get(stationId);
  if (existing && existing.day === today) return existing.atMs;
  const dayStart = new Date(nowMs);
  dayStart.setHours(0, 0, 0, 0);
  const atMs = pickDailyProbeTime(dayStart.getTime(), rng);
  schedule.set(stationId, { day: today, atMs });
  return atMs;
}

/** One scheduler tick (exported for tests). */
export async function deepProbeTick(
  db: Database.Database = getDb(),
  nowMs: number = Date.now(),
  deps: DeepProbeDeps = {}
): Promise<number> {
  const rng = deps.rng ?? Math.random;
  const stations = db
    .prepare('SELECT id, last_deep_probe FROM stations WHERE enabled = 1')
    .all() as { id: string; last_deep_probe: string | null }[];
  let fired = 0;
  for (const s of stations) {
    const at = scheduledTimeFor(s.id, nowMs, rng);
    if (dueForProbe(s.last_deep_probe, at, nowMs)) {
      fired++;
      await runDeepProbe(s.id, db, deps);
    }
  }
  return fired;
}

export function startDeepProbeJob(): void {
  if (timer) return;
  timer = setInterval(() => {
    deepProbeTick().catch((err) => console.error('Deep probe tick failed:', err));
  }, CHECK_EVERY_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log('🔎 Daily deep-probe job started (one real-question probe per station per day, random time)');
}

export function stopDeepProbeJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  schedule.clear();
}
