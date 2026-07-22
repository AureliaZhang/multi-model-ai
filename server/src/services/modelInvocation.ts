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
}

export interface InvokeModelFailure {
  ok: false;
  error: string;
  latencyMs: number;
  modelNormalizedName: string;
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
        try {
          markHealth(s.station.id, 'unhealthy');
        } catch {
          /* ignore */
        }
        continue;
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string }; text?: string }> };
      const content: string =
        data.choices?.[0]?.message?.content ??
        data.choices?.[0]?.text ??
        '';

      if (!content || !String(content).trim()) {
        errors.push(`${s.station.name}: empty content`);
        continue;
      }

      // Mark healthy on success
      try {
        markHealth(s.station.id, 'healthy');
      } catch {
        /* ignore */
      }

      return {
        ok: true,
        content: String(content),
        modelUsed: `${s.modelId} @ ${s.station.name}`,
        stationId: s.station.id,
        stationName: s.station.name,
        modelId: s.modelId,
        latencyMs: Date.now() - started,
      };
    } catch (err: unknown) {
      const msg = isAbortError(err) ? 'timeout' : getErrorMessage(err);
      errors.push(`${s.station.name}: ${msg}`);
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
  };
}

/**
 * Extract text deltas from one OpenAI-style SSE `data:` line payload.
 * Pure helper for unit tests + streamInvokeModel.
 * Returns null for [DONE] / non-content / invalid JSON.
 */
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
        continue;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

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
      };
    } catch (err: unknown) {
      const msg = isAbortError(err) ? 'timeout' : getErrorMessage(err);
      errors.push(`${s.station.name}: ${msg}`);
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
  };
}
