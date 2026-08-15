/**
 * Shared model invocation for Arena / eval (clean completion, no MCP / memory / regex).
 * Chat route keeps its own streaming path for now; Arena uses this service.
 *
 * Optional `deps` lets unit tests inject station list + fetch + health callbacks
 * without spinning up SQLite or a real network.
 */

import { getDb } from '../database';
import { normalizeModelName } from './normalizeModelName';
import { roundRobin } from './loadBalancer';
import { getErrorMessage, isAbortError } from '../utils/errors';
import { decryptSecret } from '../utils/crypto';
import type { StationModelJoinRow } from '../dbRows';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InvokeModelOptions {
  modelNormalizedName: string;
  messages: ChatMessage[];
  /** Request timeout in ms (default 120_000) */
  timeoutMs?: number;
  temperature?: number;
  /** Use admin model pool (admin_enabled) instead of public only */
  adminPool?: boolean;
}

export interface InvokeModelSuccess {
  ok: true;
  content: string;
  modelUsed: string;
  stationId: string;
  stationName: string;
  modelId: string;
  latencyMs: number;
  /** Token receipt from the upstream response (v0.7.66); null fields when the
   *  station didn't report usage. Lets background callers (KB digest, arena,
   *  rooms) account tokens instead of just request counts. */
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
}

export interface InvokeModelFailure {
  ok: false;
  error: string;
  latencyMs: number;
  modelNormalizedName: string;
  /**
   * Per-station breakdown, already key-redacted (v0.7.93). `error` above stays
   * the raw joined string for callers that only log it; anything shown to a
   * user should classify these instead — see routes/rooms.ts, which must not
   * broadcast upstream bodies to a whole room.
   */
  stationFailures?: StationFailure[];
}

export type InvokeModelResult = InvokeModelSuccess | InvokeModelFailure;

export interface StationPick {
  station: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    healthStatus: string;
  };
  modelId: string;
}

/** Injectable seams for unit tests (defaults = production DB + global fetch). */
export interface InvokeModelDeps {
  getStations?: (normalizedName: string, opts?: { adminPool?: boolean }) => StationPick[];
  fetchImpl?: typeof fetch;
  markStationHealth?: (stationId: string, status: 'healthy' | 'unhealthy') => void;
}

/**
 * Pure: from station_models ⨝ stations rows, keep matches for `normalizedName`,
 * prefer healthy/unknown over unhealthy. Does NOT round-robin (caller may).
 */
export function filterStationsForModel(
  rows: StationModelJoinRow[],
  normalizedName: string
): StationPick[] {
  const healthy: StationPick[] = [];
  const unhealthy: StationPick[] = [];

  for (const r of rows) {
    if (normalizeModelName(r.model_id) !== normalizedName) continue;
    const pick: StationPick = {
      station: {
        id: r.id,
        name: r.name,
        baseUrl: r.base_url,
        apiKey: decryptSecret(r.api_key),
        healthStatus: r.health_status,
      },
      modelId: r.model_id,
    };
    if (r.health_status === 'unhealthy') unhealthy.push(pick);
    else healthy.push(pick);
  }

  return healthy.length > 0 ? healthy : unhealthy;
}

export function getStationsForModel(
  normalizedName: string,
  opts?: { adminPool?: boolean }
): StationPick[] {
  const db = getDb();
  // adminPool: allow admin-selected models; otherwise only public (enabled)
  const poolFilter = opts?.adminPool
    ? 'COALESCE(sm.admin_enabled, 1) = 1'
    : 'sm.enabled = 1';

  const rows = db.prepare(`
    SELECT sm.model_id, s.id, s.name, s.base_url, s.api_key, s.health_status, s.enabled
    FROM station_models sm
    JOIN stations s ON sm.station_id = s.id
    WHERE ${poolFilter} AND s.enabled = 1
  `).all() as StationModelJoinRow[];

  const pool = filterStationsForModel(rows, normalizedName);
  // Round-robin across stations for this model (even spread, keeps failover order)
  return roundRobin(normalizedName, pool);
}

/** Why getStationsForModel() came back empty. */
export type NoStationReason = 'model-unknown' | 'station-disabled' | 'model-not-enabled';

/**
 * Explain an empty station pool (v0.7.89). All three states used to surface as
 * one "no healthy stations available" message telling the user to wait and
 * retry — misleading, because none of them is transient and waiting never helps.
 * Note what is NOT in here: an unhealthy station is not a cause, since
 * filterStationsForModel falls back to unhealthy ones rather than returning [].
 *
 * Only meaningful when the pool really is empty; call it on that path only.
 * Pure half, so it can be tested without SQLite (same split as
 * filterStationsForModel / getStationsForModel above).
 */
export function diagnoseNoStationFromRows(
  rows: { model_id: string; station_enabled: number }[],
  normalizedName: string
): NoStationReason {
  const matching = rows.filter((r) => normalizeModelName(r.model_id) === normalizedName);
  if (matching.length === 0) return 'model-unknown';
  if (!matching.some((r) => r.station_enabled === 1)) return 'station-disabled';
  // The model exists behind a live station, so the only filter left is the pool
  // flag (station_models.enabled / admin_enabled).
  return 'model-not-enabled';
}

export function diagnoseNoStation(normalizedName: string): NoStationReason {
  const db = getDb();
  // Deliberately unfiltered: we are asking why the filters excluded everything.
  const rows = db.prepare(`
    SELECT sm.model_id, s.enabled AS station_enabled
    FROM station_models sm
    JOIN stations s ON sm.station_id = s.id
  `).all() as { model_id: string; station_enabled: number }[];
  return diagnoseNoStationFromRows(rows, normalizedName);
}

/**
 * Server-side text for each reason. The client matches on these to pick a
 * localized string (client/src/utils/errors.ts), so they are a contract —
 * both sides are unit-tested against them. Keep them distinctive.
 */
export function noStationMessage(reason: NoStationReason, normalizedName: string): string {
  switch (reason) {
    case 'model-unknown':
      return `No station provides model "${normalizedName}" — it may have been renamed or removed`;
    case 'station-disabled':
      return `Every station providing model "${normalizedName}" is disabled`;
    case 'model-not-enabled':
      return `Model "${normalizedName}" is not enabled for use — an admin must enable it in Settings`;
  }
}

/** One station's failed attempt, kept so the user can be told what actually happened. */
export interface StationFailure {
  stationName: string;
  /** HTTP status when the station answered, null when the request never landed. */
  status: number | null;
  /** Upstream body or thrown error, already truncated and key-redacted. */
  detail: string;
}

export type UpstreamFailureKind =
  | 'upstream-auth'
  | 'upstream-not-found'
  | 'upstream-rate-limited'
  | 'upstream-server-error'
  | 'upstream-unreachable'
  | 'upstream-unknown';

/**
 * Turn a round of failed attempts into ONE cause (v0.7.90). Before this, every
 * upstream failure — a wrong API key, a typo'd base URL, the provider being
 * down — collapsed into the bare string "All stations failed", with each
 * station's real answer thrown away (the !response.ok branch never even read
 * the body). The owner had no way to tell "my key is wrong" from "they're down".
 *
 * Picked by severity of what the user must DO, not by count: a 401 anywhere is
 * worth reporting even if another station merely timed out, because a wrong key
 * is the actionable one. Rate limiting ranks last of the answered statuses — it
 * is the only genuinely transient cause, so it should not mask a real misconfig.
 */
export function classifyUpstreamFailures(failures: StationFailure[]): UpstreamFailureKind {
  if (failures.length === 0) return 'upstream-unknown';
  const has = (pred: (s: number) => boolean) =>
    failures.some((f) => f.status !== null && pred(f.status));

  if (has((s) => s === 401 || s === 403)) return 'upstream-auth';
  if (has((s) => s === 404)) return 'upstream-not-found';
  if (has((s) => s >= 500)) return 'upstream-server-error';
  if (has((s) => s === 429)) return 'upstream-rate-limited';
  // Nothing answered at all → the requests never landed.
  if (failures.every((f) => f.status === null)) return 'upstream-unreachable';
  return 'upstream-unknown';
}

/**
 * Client-matchable text per cause — same contract style as noStationMessage(),
 * unit-tested on both sides.
 */
export function upstreamFailureMessage(kind: UpstreamFailureKind): string {
  switch (kind) {
    case 'upstream-auth':
      return 'Upstream rejected the credentials (401/403)';
    case 'upstream-not-found':
      return 'Upstream endpoint or model not found (404)';
    case 'upstream-rate-limited':
      return 'Upstream rate limited the request (429)';
    case 'upstream-server-error':
      return 'Upstream returned a server error (5xx)';
    case 'upstream-unreachable':
      return 'Could not reach any station';
    case 'upstream-unknown':
      return 'All stations failed';
  }
}

/**
 * Keep a station's own key out of anything we echo back, and keep the line
 * short enough to read — some providers return an entire HTML error page.
 */
export function sanitizeUpstreamDetail(raw: string, apiKey: string, max = 300): string {
  let out = (raw || '').replace(/\s+/g, ' ').trim();
  if (apiKey && apiKey.length >= 8) out = out.split(apiKey).join('***');
  // Belt and braces: redact anything else shaped like a bearer token.
  out = out.replace(/\b(sk-|Bearer\s+)[A-Za-z0-9_\-]{8,}/g, '$1***');
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

function defaultMarkStationHealth(stationId: string, status: 'healthy' | 'unhealthy'): void {
  const db = getDb();
  const now = new Date().toISOString();
  if (status === 'healthy') {
    db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?')
      .run('healthy', now, now, stationId);
  } else {
    db.prepare('UPDATE stations SET health_status = ?, updated_at = ? WHERE id = ?')
      .run('unhealthy', now, stationId);
  }
}

/**
 * Non-streaming chat completion with station failover.
 * Does not attach MCP tools, memory, or regex — suitable for comparable evals.
 */
export async function invokeModel(
  options: InvokeModelOptions,
  deps: InvokeModelDeps = {}
): Promise<InvokeModelResult> {
  const started = Date.now();
  const normalized = normalizeModelName(options.modelNormalizedName);
  const getStations = deps.getStations ?? getStationsForModel;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const markHealth = deps.markStationHealth ?? defaultMarkStationHealth;

  const stations = getStations(normalized, { adminPool: options.adminPool });
  const timeoutMs = options.timeoutMs ?? 120_000;

  if (stations.length === 0) {
    return {
      ok: false,
      error: `No enabled station serves model "${normalized}"`,
      latencyMs: Date.now() - started,
      modelNormalizedName: normalized,
    };
  }

  const errors: string[] = [];
  // Structured twin of `errors` (v0.7.93): same events, but with the status and
  // a redacted body kept apart, so a caller can classify the cause instead of
  // showing the raw join. `errors` stays as-is for existing callers.
  const stationFailures: StationFailure[] = [];

  for (const s of stations) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: s.modelId,
        messages: options.messages,
        stream: false,
      };
      if (options.temperature !== undefined) {
        body.temperature = options.temperature;
      }

      const response = await fetchImpl(`${s.station.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${s.station.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        errors.push(`${s.station.name}: HTTP ${response.status} ${text.slice(0, 200)}`);
        stationFailures.push({
          stationName: s.station.name,
          status: response.status,
          detail: sanitizeUpstreamDetail(text, s.station.apiKey),
        });
        try {
          markHealth(s.station.id, 'unhealthy');
        } catch {
          /* ignore */
        }
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; text?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const content: string =
        data.choices?.[0]?.message?.content ??
        data.choices?.[0]?.text ??
        '';

      if (!content || !String(content).trim()) {
        errors.push(`${s.station.name}: empty content`);
        stationFailures.push({
          stationName: s.station.name,
          // 2xx with nothing usable in it. Recorded with the real status rather
          // than null so it is not mistaken for "never reached the station".
          status: response.status,
          detail: 'empty content',
        });
        continue;
      }

      // Mark healthy on success
      try {
        markHealth(s.station.id, 'healthy');
      } catch {
        /* ignore */
      }

      // v0.7.66: catch the token receipt (OpenAI-compatible `usage` block).
      const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      return {
        ok: true,
        content: String(content),
        modelUsed: `${s.modelId} @ ${s.station.name}`,
        stationId: s.station.id,
        stationName: s.station.name,
        modelId: s.modelId,
        latencyMs: Date.now() - started,
        usage: {
          promptTokens: num(data.usage?.prompt_tokens),
          completionTokens: num(data.usage?.completion_tokens),
          totalTokens: num(data.usage?.total_tokens),
        },
      };
    } catch (err: unknown) {
      const msg = isAbortError(err) ? 'timeout' : getErrorMessage(err);
      errors.push(`${s.station.name}: ${msg}`);
      // status null = the request never got an answer (DNS, TLS, refused, timeout).
      stationFailures.push({
        stationName: s.station.name,
        status: null,
        detail: sanitizeUpstreamDetail(msg, s.station.apiKey),
      });
      try {
        markHealth(s.station.id, 'unhealthy');
      } catch {
        /* ignore */
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    error: errors.length ? errors.join(' | ') : 'All stations failed',
    latencyMs: Date.now() - started,
    modelNormalizedName: normalized,
    stationFailures,
  };
}

/**
 * Extract text deltas from one OpenAI-style SSE `data:` line payload.
 * Pure helper for unit tests + streamInvokeModel.
 * Returns null for [DONE] / non-content / invalid JSON.
 */
/** Pull a token-usage block out of one SSE data payload, if present (v0.7.66).
 *  Many OpenAI-compatible relays attach `usage` to the final chunk. Pure. */
export function extractSseUsage(dataLine: string): { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null {
  const data = dataLine.trim();
  if (!data || data === '[DONE]') return null;
  try {
    const parsed = JSON.parse(data) as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    if (!parsed.usage || typeof parsed.usage !== 'object') return null;
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const u = { promptTokens: num(parsed.usage.prompt_tokens), completionTokens: num(parsed.usage.completion_tokens), totalTokens: num(parsed.usage.total_tokens) };
    return u.promptTokens === null && u.completionTokens === null && u.totalTokens === null ? null : u;
  } catch {
    return null;
  }
}

export function extractSseContentDelta(dataLine: string): string | null {
  const data = dataLine.trim();
  if (!data || data === '[DONE]') return null;
  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string }; text?: string }>;
    };
    const delta = parsed.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) return delta;
    // Some proxies send non-delta text fields mid-stream
    const text = parsed.choices?.[0]?.text;
    if (typeof text === 'string' && text.length > 0) return text;
    return null;
  } catch {
    return null;
  }
}

export interface StreamInvokeOptions extends InvokeModelOptions {
  /** Called for each text delta (may be multi-char). */
  onDelta?: (delta: string, fullSoFar: string) => void;
}

/**
 * Streaming chat completion with station failover.
 * Same station selection / health marking as `invokeModel`, but uses stream:true
 * and invokes `onDelta` as tokens arrive. Used by group-chat @AI (WS fan-out).
 * Does not attach MCP tools / memory / regex.
 */
export async function streamInvokeModel(
  options: StreamInvokeOptions,
  deps: InvokeModelDeps = {}
): Promise<InvokeModelResult> {
  const started = Date.now();
  const normalized = normalizeModelName(options.modelNormalizedName);
  const getStations = deps.getStations ?? getStationsForModel;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const markHealth = deps.markStationHealth ?? defaultMarkStationHealth;
  const onDelta = options.onDelta;

  const stations = getStations(normalized, { adminPool: options.adminPool });
  const timeoutMs = options.timeoutMs ?? 120_000;

  if (stations.length === 0) {
    return {
      ok: false,
      error: `No enabled station serves model "${normalized}"`,
      latencyMs: Date.now() - started,
      modelNormalizedName: normalized,
    };
  }

  const errors: string[] = [];
  // Structured twin of `errors` (v0.7.93): same events, but with the status and
  // a redacted body kept apart, so a caller can classify the cause instead of
  // showing the raw join. `errors` stays as-is for existing callers.
  const stationFailures: StationFailure[] = [];

  for (const s of stations) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: s.modelId,
        messages: options.messages,
        stream: true,
      };
      if (options.temperature !== undefined) {
        body.temperature = options.temperature;
      }

      const response = await fetchImpl(`${s.station.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${s.station.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        errors.push(`${s.station.name}: HTTP ${response.status} ${text.slice(0, 200)}`);
        stationFailures.push({
          stationName: s.station.name,
          status: response.status,
          detail: sanitizeUpstreamDetail(text, s.station.apiKey),
        });
        try {
          markHealth(s.station.id, 'unhealthy');
        } catch {
          /* ignore */
        }
        continue;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        errors.push(`${s.station.name}: no response body`);
        stationFailures.push({
          stationName: s.station.name,
          status: response.status,
          detail: 'no response body',
        });
        continue;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let streamUsage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trimStart();
          streamUsage = extractSseUsage(payload) ?? streamUsage;
          const delta = extractSseContentDelta(payload);
          if (delta == null) continue;
          full += delta;
          try {
            onDelta?.(delta, full);
          } catch {
            /* listener errors must not break the stream */
          }
        }
      }

      // Flush any remaining buffered line
      if (buffer.trim().startsWith('data:')) {
        const payload = buffer.trim().slice(5).trimStart();
        streamUsage = extractSseUsage(payload) ?? streamUsage;
        const delta = extractSseContentDelta(payload);
        if (delta != null) {
          full += delta;
          try {
            onDelta?.(delta, full);
          } catch {
            /* ignore */
          }
        }
      }

      if (!full.trim()) {
        errors.push(`${s.station.name}: empty content`);
        stationFailures.push({
          stationName: s.station.name,
          // 2xx with nothing usable in it. Recorded with the real status rather
          // than null so it is not mistaken for "never reached the station".
          status: response.status,
          detail: 'empty content',
        });
        continue;
      }

      try {
        markHealth(s.station.id, 'healthy');
      } catch {
        /* ignore */
      }

      return {
        ok: true,
        content: full,
        modelUsed: `${s.modelId} @ ${s.station.name}`,
        stationId: s.station.id,
        stationName: s.station.name,
        modelId: s.modelId,
        latencyMs: Date.now() - started,
        usage: streamUsage ?? { promptTokens: null, completionTokens: null, totalTokens: null },
      };
    } catch (err: unknown) {
      const msg = isAbortError(err) ? 'timeout' : getErrorMessage(err);
      errors.push(`${s.station.name}: ${msg}`);
      // status null = the request never got an answer (DNS, TLS, refused, timeout).
      stationFailures.push({
        stationName: s.station.name,
        status: null,
        detail: sanitizeUpstreamDetail(msg, s.station.apiKey),
      });
      try {
        markHealth(s.station.id, 'unhealthy');
      } catch {
        /* ignore */
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    error: errors.length ? errors.join(' | ') : 'All stations failed',
    latencyMs: Date.now() - started,
    modelNormalizedName: normalized,
    stationFailures,
  };
}
