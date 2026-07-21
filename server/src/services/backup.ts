/**
 * Database backup (§10.8 "Data safety" — Phase 2).
 *
 * "Silent data loss is unacceptable for a shared team DB." This provides an
 * online snapshot story using better-sqlite3's native `db.backup()` (WAL-safe,
 * non-blocking — it does NOT stop the app while copying):
 *
 *   - `runBackupSweep()` writes a timestamped `app-YYYYMMDD-HHMMSS.db` snapshot
 *     into the backup dir, then prunes to the most-recent `keep` snapshots.
 *   - `startBackupJob()` schedules that sweep on an interval (`.unref()`'d so it
 *     never holds the process open), skipping in-memory DBs and when disabled.
 *   - The admin route (`/api/backups`) reuses `runBackupSweep()` for on-demand
 *     snapshots (e.g. before a risky import) regardless of the schedule.
 *
 * All config is env-tunable via `parseBackupOptions()` (pure — unit-tested).
 */

import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { getDb, DB_PATH } from '../database';
import { getErrorMessage } from '../utils/errors';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const DEFAULT_KEEP = 7;

export interface BackupOptions {
  /** Whether the SCHEDULED job runs. Manual (admin) backups ignore this. */
  enabled: boolean;
  /** Directory snapshots are written to. */
  dir: string;
  /** Scheduled sweep interval in ms. */
  intervalMs: number;
  /** Keep this many most-recent snapshots; 0 = keep all. */
  keep: number;
}

/** Default backup directory: a `backups/` sibling of the live DB file. */
export function defaultBackupDir(dbPath: string = DB_PATH): string {
  return path.join(path.dirname(dbPath), 'backups');
}

/** Parse backup config from environment. Pure — safe to unit-test. */
export function parseBackupOptions(env: NodeJS.ProcessEnv = process.env): BackupOptions {
  const raw = env.BACKUP_ENABLED?.trim().toLowerCase();
  // Default ON (data safety); explicit falsy values turn the scheduled job off.
  const enabled = raw === undefined || raw === ''
    ? true
    : !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off');

  const dir = env.BACKUP_DIR?.trim() || defaultBackupDir();

  const intervalNum = Number(env.BACKUP_INTERVAL_MS);
  const intervalMs = Number.isFinite(intervalNum) && intervalNum > 0 ? intervalNum : DEFAULT_INTERVAL_MS;

  const keepNum = Number(env.BACKUP_KEEP);
  const keep = Number.isFinite(keepNum) && keepNum >= 0 ? Math.floor(keepNum) : DEFAULT_KEEP;

  return { enabled, dir, intervalMs, keep };
}

const BACKUP_FILE_RE = /^app-\d{8}-\d{6}\.db$/;

/** Timestamped snapshot filename. Injectable date for deterministic tests. */
export function makeBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `app-${stamp}.db`;
}

/**
 * Write an online snapshot of `db` to `destPath` (creating parent dirs).
 * `db.backup()` is WAL-safe and non-blocking.
 */
export async function backupDatabaseTo(destPath: string, db: Database.Database = getDb()): Promise<void> {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await db.backup(destPath);
}

/**
 * Delete all but the newest `keep` snapshots in `dir`. Filenames are timestamped
 * and therefore lexicographically sortable (oldest first). Returns deleted names.
 * keep <= 0 keeps everything; a missing dir is treated as empty.
 */
export function pruneBackups(dir: string, keep: number): string[] {
  if (keep <= 0) return [];
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => BACKUP_FILE_RE.test(f));
  } catch {
    return [];
  }
  if (files.length <= keep) return [];
  files.sort(); // ascending: oldest first
  const toDelete = files.slice(0, files.length - keep);
  const deleted: string[] = [];
  for (const f of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, f));
      deleted.push(f);
    } catch {
      /* ignore individual unlink errors — best-effort prune */
    }
  }
  return deleted;
}

/**
 * Take one snapshot and prune old ones. Used by both the scheduled job and the
 * admin route. `now` is injectable for deterministic tests.
 */
export async function runBackupSweep(
  opts: BackupOptions = parseBackupOptions(),
  db: Database.Database = getDb(),
  now: Date = new Date()
): Promise<{ file: string; pruned: string[] }> {
  const destPath = path.join(opts.dir, makeBackupFilename(now));
  await backupDatabaseTo(destPath, db);
  const pruned = pruneBackups(opts.dir, opts.keep);
  return { file: destPath, pruned };
}

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic backup sweep. Idempotent. No-op (with a log) when disabled
 * or when the DB is in-memory (nothing durable to protect). The timer is
 * `unref()`'d so it never keeps the process alive on its own.
 */
export function startBackupJob(opts: BackupOptions = parseBackupOptions()): void {
  if (timer) return;
  if (!opts.enabled) {
    console.log('💾 Backup job disabled (set BACKUP_ENABLED=1 to enable)');
    return;
  }
  if ((process.env.DB_PATH || '').trim() === ':memory:') {
    return; // in-memory DB: nothing to back up
  }

  timer = setInterval(() => {
    runBackupSweep(opts)
      .then(({ file, pruned }) => {
        console.log(
          `💾 DB backup written: ${path.basename(file)}` +
          (pruned.length ? ` (pruned ${pruned.length} old)` : '')
        );
      })
      .catch((err) => console.error('DB backup failed:', getErrorMessage(err)));
  }, opts.intervalMs);

  if (typeof timer.unref === 'function') timer.unref();

  const hours = opts.intervalMs / 3_600_000;
  const every = hours >= 1 ? `${Math.round(hours)}h` : `${Math.round(opts.intervalMs / 1000)}s`;
  console.log(`💾 Backup job started (every ${every} → ${opts.dir}, keep ${opts.keep === 0 ? 'all' : opts.keep})`);
}

/** Stop the periodic sweep (graceful shutdown / tests). */
export function stopBackupJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
