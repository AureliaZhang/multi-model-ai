/**
 * Shared model invocation for Arena / eval (clean completion, no MCP / memory / regex).
 * Chat route keeps its own streaming path for now; Arena uses this service.
 */

import { getDb } from '../database';
import { normalizeModelName } from './normalizeModelName';
import { roundRobin } from './loadBalancer';

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
}

export interface InvokeModelFailure {
  ok: false;
  error: string;
  latencyMs: number;
  modelNormalizedName: string;
}

export type InvokeModelResult = InvokeModelSuccess | InvokeModelFailure;

interface StationPick {
  station: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    healthStatus: string;
  };
  modelId: string;
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
  `).all() as any[];

  const healthy: StationPick[] = [];
  const unhealthy: StationPick[] = [];

  for (const r of rows) {
    if (normalizeModelName(r.model_id) !== normalizedName) continue;
    const pick: StationPick = {
      station: {
        id: r.id,
        name: r.name,
        baseUrl: r.base_url,
        apiKey: r.api_key,
        healthStatus: r.health_status,
      },
      modelId: r.model_id,
    };
    if (r.health_status === 'unhealthy') unhealthy.push(pick);
    else healthy.push(pick);
  }

  // Prefer healthy / unknown; fall back to unhealthy if nothing else
  const pool = healthy.length > 0 ? healthy : unhealthy;
  // Round-robin across stations for this model (even spread, keeps failover order)
  return roundRobin(normalizedName, pool);
}

/**
 * Non-streaming chat completion with station failover.
 * Does not attach MCP tools, memory, or regex — suitable for comparable evals.
 */
export async function invokeModel(options: InvokeModelOptions): Promise<InvokeModelResult> {
  const started = Date.now();
  const normalized = normalizeModelName(options.modelNormalizedName);
  const stations = getStationsForModel(normalized, { adminPool: options.adminPool });
  const timeoutMs = options.timeoutMs ?? 120_000;

  if (stations.length === 0) {
    return {
      ok: false,
      error: `No enabled station serves model "${normalized}"`,
      latencyMs: Date.now() - started,
      modelNormalizedName: normalized,
    };
  }

  const db = getDb();
  const errors: string[] = [];

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

      const response = await fetch(`${s.station.baseUrl}/chat/completions`, {
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
        db.prepare('UPDATE stations SET health_status = ?, updated_at = ? WHERE id = ?')
          .run('unhealthy', new Date().toISOString(), s.station.id);
        continue;
      }

      const data = (await response.json()) as any;
      const content: string =
        data.choices?.[0]?.message?.content ??
        data.choices?.[0]?.text ??
        '';

      if (!content || !String(content).trim()) {
        errors.push(`${s.station.name}: empty content`);
        continue;
      }

      // Mark healthy on success
      db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?')
        .run('healthy', new Date().toISOString(), new Date().toISOString(), s.station.id);

      return {
        ok: true,
        content: String(content),
        modelUsed: `${s.modelId} @ ${s.station.name}`,
        stationId: s.station.id,
        stationName: s.station.name,
        modelId: s.modelId,
        latencyMs: Date.now() - started,
      };
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err));
      errors.push(`${s.station.name}: ${msg}`);
      try {
        db.prepare('UPDATE stations SET health_status = ?, updated_at = ? WHERE id = ?')
          .run('unhealthy', new Date().toISOString(), s.station.id);
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
  };
}
