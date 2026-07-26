import { describe, it, expect, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { initTables } from '../database';
import { parseRetentionOptions, retentionCutoff, runRetentionSweep } from './retention';

// TC1 #5 (F-MEM10 / §4.8 retentionDays): memory_config.retention_days was
// stored + surfaced in the UI but never enforced. These tests exercise the
// purge against an in-memory DB with the REAL schema from initTables.

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initTables(db); // also seeds the memory_config single row (retention_days = 0)
  return db;
}

function insertMemory(db: Database.Database, createdAt: string): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO memory_entries (id, conversation_id, message_id, role, content, created_at, updated_at)
    VALUES (?, ?, ?, 'user', ?, ?, ?)
  `).run(id, randomUUID(), randomUUID(), `memory created ${createdAt}`, createdAt, createdAt);
  return id;
}

function count(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS cnt FROM memory_entries').get() as { cnt: number }).cnt;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseRetentionOptions', () => {
  it('defaults: enabled, 6h interval', () => {
    const opts = parseRetentionOptions({});
    expect(opts.enabled).toBe(true);
    expect(opts.intervalMs).toBe(6 * 60 * 60 * 1000);
  });

  it('RETENTION_ENABLED=0 disables; custom interval respected; garbage interval falls back', () => {
    expect(parseRetentionOptions({ RETENTION_ENABLED: '0' }).enabled).toBe(false);
    expect(parseRetentionOptions({ RETENTION_ENABLED: 'false' }).enabled).toBe(false);
    expect(parseRetentionOptions({ RETENTION_ENABLED: 'yes' }).enabled).toBe(true);
    expect(parseRetentionOptions({ RETENTION_SWEEP_INTERVAL_MS: '60000' }).intervalMs).toBe(60000);
    expect(parseRetentionOptions({ RETENTION_SWEEP_INTERVAL_MS: '-5' }).intervalMs).toBe(6 * 60 * 60 * 1000);
    expect(parseRetentionOptions({ RETENTION_SWEEP_INTERVAL_MS: 'soon' }).intervalMs).toBe(6 * 60 * 60 * 1000);
  });
});

describe('retentionCutoff', () => {
  it('formats as SQLite datetime("now") (UTC, space-separated) minus N days', () => {
    const now = new Date('2026-07-26T12:00:00Z');
    expect(retentionCutoff(30, now)).toBe('2026-06-26 12:00:00');
    expect(retentionCutoff(1, now)).toBe('2026-07-25 12:00:00');
  });
});

describe('runRetentionSweep', () => {
  it('retention_days = 0 (default) keeps everything', () => {
    const db = freshDb();
    insertMemory(db, '2020-01-01 00:00:00');
    insertMemory(db, '2026-07-26 10:00:00');

    const result = runRetentionSweep(db, new Date('2026-07-26T12:00:00Z'));

    expect(result).toEqual({ retentionDays: 0, deleted: 0 });
    expect(count(db)).toBe(2);
    db.close();
  });

  it('deletes only entries older than the cutoff; boundary rows survive', () => {
    const db = freshDb();
    db.prepare('UPDATE memory_config SET retention_days = 30 WHERE id = 1').run();

    const now = new Date('2026-07-26T12:00:00Z'); // cutoff = 2026-06-26 12:00:00
    insertMemory(db, '2026-05-01 09:00:00'); // stale → purged
    insertMemory(db, '2026-06-26 11:59:59'); // 1s too old → purged
    const atCutoff = insertMemory(db, '2026-06-26 12:00:00'); // exactly at cutoff → kept
    const fresh = insertMemory(db, '2026-07-20 08:00:00'); // recent → kept

    const result = runRetentionSweep(db, now);

    expect(result).toEqual({ retentionDays: 30, deleted: 2 });
    const ids = (db.prepare('SELECT id FROM memory_entries').all() as Array<{ id: string }>).map((r) => r.id).sort();
    expect(ids).toEqual([atCutoff, fresh].sort());
    db.close();
  });

  it('negative retention_days is treated as keep-forever', () => {
    const db = freshDb();
    db.prepare('UPDATE memory_config SET retention_days = -7 WHERE id = 1').run();
    insertMemory(db, '2020-01-01 00:00:00');

    const result = runRetentionSweep(db, new Date('2026-07-26T12:00:00Z'));

    expect(result).toEqual({ retentionDays: 0, deleted: 0 });
    expect(count(db)).toBe(1);
    db.close();
  });

  it('picks up an admin config change on the next sweep (no restart)', () => {
    const db = freshDb();
    const now = new Date('2026-07-26T12:00:00Z');
    insertMemory(db, '2026-01-01 00:00:00');

    expect(runRetentionSweep(db, now).deleted).toBe(0); // still keep-forever

    db.prepare('UPDATE memory_config SET retention_days = 90 WHERE id = 1').run();
    expect(runRetentionSweep(db, now).deleted).toBe(1); // same process, new policy applied
    expect(count(db)).toBe(0);
    db.close();
  });
});
