/**
 * Background station health check (§8.3).
 *
 * A single shared `checkStationHealth()` pings a station's `/models` endpoint and
 * persists `health_status` + `last_health_check`. `runHealthCheckSweep()` runs it
 * over every enabled station; `startHealthCheckJob()` schedules that sweep on a
 * timer so unhealthy stations are auto-detected AND auto-recovered:
 *
 *   - A station that starts failing gets marked `unhealthy` and is skipped by the
 *     router (`getStationsForModel` prefers healthy/unknown, falls back to
 *     unhealthy only if nothing else serves the model).
 *   - When it recovers, the next sweep pings it successfully and flips it back to
 *     `healthy`, so it re-enters the routing pool with no manual step (§8.3
 *     "re-included once healthy"). No separate cooldown timer is needed — the
 *     sweep interval IS the recovery granularity.
 *
 * Interval is `HEALTH_CHECK_INTERVAL_MS` (default 60_000), matching the
 * `process.env.X || default` convention used elsewhere (see asyncPool, database).
 */

import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { decryptSecret } from '../utils/crypto';

const DEFAULT_INTERVAL_MS = 60_000;
const PING_TIMEOUT_MS = 10_000;

export type HealthStatus = 'healthy' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  /** Empty on success; short reason (e.g. "HTTP 401", "Timeout") on failure. */
  detail: string;
}

/**
 * Ping one station's `/models` endpoint and persist the result.
 * Shared by the background sweep and the manual `POST /:id/health-check` route.
 *
 * @param station Row with at least { id, base_url, api_key }.
 */
export async function checkStationHealth(
  db: Database.Database,
  station: { id: string; base_url: string; api_key: string }
): Promise<HealthCheckResult> {
  const baseUrl = station.base_url.replace(/\/+$/, '');
  const modelsUrl = `${baseUrl}/models`;
  const now = new Date().toISOString();

  let status: HealthStatus = 'unhealthy';
  let detail = '';
  try {
    const response = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${decryptSecret(station.api_key)}` },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (response.ok) {
      status = 'healthy';
    } else {
      detail = `HTTP ${response.status}`;
    }
  } catch (err) {
    status = 'unhealthy';
    detail = (err as Error)?.name === 'TimeoutError' ? 'Timeout' : (err as Error)?.message || 'error';
  }

  db.prepare('UPDATE stations SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?').run(
    status,
    now,
    now,
    station.id
  );

  return { status, detail };
}

/**
 * Ping every enabled station once, in parallel. Errors on individual stations
 * are swallowed (they surface as `unhealthy`) so one bad station never aborts
 * the sweep. Returns a small summary for logging.
 */
export async function runHealthCheckSweep(db: Database.Database = getDb()): Promise<{
  total: number;
  healthy: number;
  unhealthy: number;
}> {
  const stations = db
    .prepare('SELECT id, base_url, api_key FROM stations WHERE enabled = 1')
    .all() as { id: string; base_url: string; api_key: string }[];

  const results = await Promise.all(
    stations.map((s) =>
      checkStationHealth(db, s).catch(() => ({ status: 'unhealthy' as HealthStatus, detail: 'sweep error' }))
    )
  );

  const healthy = results.filter((r) => r.status === 'healthy').length;
  return { total: results.length, healthy, unhealthy: results.length - healthy };
}

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic health-check sweep. Idempotent — a second call is a no-op
 * while a job is already running. The timer is `unref()`'d so it never keeps the
 * process alive on its own.
 */
export function startHealthCheckJob(): void {
  if (timer) return;

  const interval = Number(process.env.HEALTH_CHECK_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  timer = setInterval(() => {
    runHealthCheckSweep()
      .then(({ total, healthy, unhealthy }) => {
        if (total > 0) {
          console.log(`🩺 Health check: ${healthy}/${total} healthy${unhealthy ? `, ${unhealthy} unhealthy` : ''}`);
        }
      })
      .catch((err) => console.error('Health check sweep failed:', err));
  }, interval);

  // Don't hold the event loop open just for the health timer.
  if (typeof timer.unref === 'function') timer.unref();

  console.log(`🩺 Health check job started (every ${Math.round(interval / 1000)}s)`);
}

/** Stop the periodic sweep (graceful shutdown / tests). */
export function stopHealthCheckJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
