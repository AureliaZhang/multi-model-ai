/**
 * Memory retention purge (§10.8 TC1 #5 — F-MEM10 / §4.8 `retentionDays`).
 *
 * `memory_config.retention_days` has been stored and surfaced in the Memory
 * settings UI since the beginning, but was never enforced — memories lived
 * forever regardless of the configured retention. This service closes that gap:
 *
 *   - `runRetentionSweep()` reads `retention_days` from `memory_config` (the
 *     admin-set, instance-wide single row) and deletes `memory_entries` whose
 *     `created_at` is older than the cutoff. `0` (the default) = keep forever.
 *   - `startRetentionJob()` runs one sweep shortly after boot (so a config
 *     change doesn't wait a full interval to take effect) and then on a timer
 *     (`.unref()`'d so it never holds the process open). Kill-switch +
 *     interval are env-tunable; the *policy* (how many days) stays in the DB
 *     where the admin UI already edits it.
 *
 * Deliberately instance-wide (not per-user): `memory_config` is a single row
 * and the Memory settings UI edits it as such — same scope as auto-save and
 * context injection.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { getErrorMessage } from '../utils/errors';

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6h — cheap query, keeps drift ≤ 6h past the configured horizon
const BOOT_DELAY_MS = 30 * 1000; // first sweep shortly after boot, off the startup critical path

export interface RetentionOptions {
  /** Whether the scheduled job runs. The sweep itself can still be called manually. */
  enabled: boolean;
  /** Sweep interval in ms. */
  intervalMs: number;
}

/** Parse retention job config from environment. Pure — safe to unit-test. */
export function parseRetentionOptions(env: NodeJS.ProcessEnv = process.env): RetentionOptions {
  const raw = env.RETENTION_ENABLED?.trim().toLowerCase();
  // Default ON — the admin-facing policy lives in memory_config; retention_days=0
  // (the DB default) already means "keep forever", so the job is a safe no-op
  // until an admin actually configures a retention window.
  const enabled = raw === undefined || raw === ''
    ? true
    : !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off');

  const intervalNum = Number(env.RETENTION_SWEEP_INTERVAL_MS);
  const intervalMs = Number.isFinite(intervalNum) && intervalNum > 0 ? intervalNum : DEFAULT_INTERVAL_MS;

  return { enabled, intervalMs };
}

/**
 * SQLite `datetime('now')` format (`YYYY-MM-DD HH:MM:SS`, UTC) for `date` minus
 * `days` days. `memory_entries.created_at` rows are stored in this format, so a
 * plain string comparison against the cutoff is correct. Exported for tests.
 */
export function retentionCutoff(days: number, now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Delete memory entries older than the configured retention window.
 * Reads `retention_days` live from `memory_config` so an admin change applies
 * on the next sweep without a restart. Returns what happened (for logs/tests).
 * `now` is injectable for deterministic tests.
 */
export function runRetentionSweep(
  db: Database.Database = getDb(),
  now: Date = new Date()
): { retentionDays: number; deleted: number } {
  const row = db.prepare('SELECT retention_days FROM memory_config WHERE id = 1').get() as
    | { retention_days: number }
    | undefined;
  const retentionDays = row ? Math.floor(row.retention_days) : 0;

  // 0 (default) or negative/garbage = keep forever. Never purge in that case.
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return { retentionDays: 0, deleted: 0 };
  }

  const cutoff = retentionCutoff(retentionDays, now);
  const result = db.prepare('DELETE FROM memory_entries WHERE created_at < ?').run(cutoff);
  return { retentionDays, deleted: result.changes };
}

let timer: ReturnType<typeof setInterval> | null = null;
let bootTimer: ReturnType<typeof setTimeout> | null = null;

function sweepAndLog(): void {
  try {
    const { retentionDays, deleted } = runRetentionSweep();
    if (deleted > 0) {
      console.log(`🧹 Memory retention purge: deleted ${deleted} entr${deleted === 1 ? 'y' : 'ies'} older than ${retentionDays}d`);
    }
  } catch (err) {
    console.error('Memory retention purge failed:', getErrorMessage(err));
  }
}

/**
 * Start the periodic retention sweep. Idempotent. Runs once shortly after boot,
 * then on the configured interval. Both timers are `unref()`'d so they never
 * keep the process alive on their own.
 */
export function startRetentionJob(opts: RetentionOptions = parseRetentionOptions()): void {
  if (timer) return;
  if (!opts.enabled) {
    console.log('🧹 Memory retention job disabled (unset RETENTION_ENABLED to re-enable)');
    return;
  }

  bootTimer = setTimeout(sweepAndLog, BOOT_DELAY_MS);
  if (typeof bootTimer.unref === 'function') bootTimer.unref();

  timer = setInterval(sweepAndLog, opts.intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  const hours = opts.intervalMs / 3_600_000;
  const every = hours >= 1 ? `${Math.round(hours)}h` : `${Math.round(opts.intervalMs / 1000)}s`;
  console.log(`🧹 Memory retention job started (every ${every}; policy = memory_config.retention_days, 0 = keep forever)`);
}

/** Stop the periodic sweep (graceful shutdown / tests). */
export function stopRetentionJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
}
