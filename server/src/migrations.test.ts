import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';
import {
  runMigrations,
  getAppliedVersions,
  ensureMigrationsTable,
  type Migration,
} from './migrations';
import { SCHEMA_MIGRATIONS, initTables } from './database';

function mem(): Database.Database {
  return new Database(':memory:');
}

describe('runMigrations', () => {
  it('applies pending migrations in ascending order and records them', () => {
    const db = mem();
    const order: number[] = [];
    const migs: Migration[] = [
      { version: 2, name: 'b', up: (d) => { order.push(2); d.exec('CREATE TABLE b(x)'); } },
      { version: 1, name: 'a', up: (d) => { order.push(1); d.exec('CREATE TABLE a(x)'); } },
    ];

    const res = runMigrations(db, migs);

    expect(order).toEqual([1, 2]); // sorted regardless of input order
    expect(res.applied).toEqual([1, 2]);
    expect(res.skipped).toEqual([]);
    expect(res.currentVersion).toBe(2);
    expect(getAppliedVersions(db)).toEqual(new Set([1, 2]));
    // both tables exist
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('a','b')").all()).toHaveLength(2);
  });

  it('is idempotent — a second run applies nothing and never re-invokes up', () => {
    const db = mem();
    let calls = 0;
    // No IF NOT EXISTS: a second invocation of up() would throw — proves it is skipped.
    const migs: Migration[] = [
      { version: 1, name: 'a', up: (d) => { calls++; d.exec('CREATE TABLE a(x)'); } },
    ];

    runMigrations(db, migs);
    const res2 = runMigrations(db, migs);

    expect(calls).toBe(1);
    expect(res2.applied).toEqual([]);
    expect(res2.skipped).toEqual([1]);
    expect(res2.currentVersion).toBe(1);
  });

  it('runs only the newly-appended migration on a later call', () => {
    const db = mem();
    const v1: Migration = { version: 1, name: 'a', up: (d) => d.exec('CREATE TABLE a(x)') };
    runMigrations(db, [v1]);

    let v2ran = false;
    const v2: Migration = { version: 2, name: 'b', up: (d) => { v2ran = true; d.exec('CREATE TABLE b(x)'); } };
    const res = runMigrations(db, [v1, v2]);

    expect(v2ran).toBe(true);
    expect(res.applied).toEqual([2]);
    expect(res.skipped).toEqual([1]);
    expect(getAppliedVersions(db)).toEqual(new Set([1, 2]));
  });

  it('rolls back and aborts loudly when a migration throws (atomic, no half-apply)', () => {
    const db = mem();
    const migs: Migration[] = [
      { version: 1, name: 'ok', up: (d) => d.exec('CREATE TABLE ok(x)') },
      {
        version: 2,
        name: 'boom',
        up: (d) => {
          d.exec('CREATE TABLE boom(x)'); // side effect that must be rolled back
          throw new Error('kaboom');
        },
      },
      { version: 3, name: 'never', up: (d) => d.exec('CREATE TABLE never(x)') },
    ];

    expect(() => runMigrations(db, migs)).toThrow(/v2 \(boom\) failed: kaboom/);

    // v1 committed; v2 rolled back (table gone, not in ledger); v3 never attempted.
    expect(getAppliedVersions(db)).toEqual(new Set([1]));
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ok','boom','never')")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(['ok']);
  });

  it('rejects duplicate and non-positive versions', () => {
    const db = mem();
    expect(() => runMigrations(db, [
      { version: 1, name: 'a', up: () => {} },
      { version: 1, name: 'dup', up: () => {} },
    ])).toThrow(/Duplicate migration version 1/);

    expect(() => runMigrations(mem(), [
      { version: 0, name: 'zero', up: () => {} },
    ])).toThrow(/Invalid migration version 0/);
  });

  it('ensureMigrationsTable / getAppliedVersions work on a bare DB (no throw, empty set)', () => {
    const db = mem();
    ensureMigrationsTable(db);
    expect(getAppliedVersions(db)).toEqual(new Set());
  });
});

describe('SCHEMA_MIGRATIONS (real migration set)', () => {
  const versions = SCHEMA_MIGRATIONS.map((m) => m.version).sort((a, b) => a - b);

  it('builds the full schema on a fresh DB and records every version', () => {
    const db = mem();
    db.pragma('foreign_keys = ON');
    const res = runMigrations(db, SCHEMA_MIGRATIONS);

    expect(res.applied).toEqual(versions);
    expect(res.currentVersion).toBe(Math.max(...versions));
    for (const v of versions) expect(getAppliedVersions(db).has(v)).toBe(true);

    // Spot-check tables from across the baseline (users, rooms, arena, ledger).
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of ['users', 'conversations', 'rooms', 'arena_battle_sessions', 'schema_migrations']) {
      expect(names).toContain(t);
    }
    // v2 column present.
    const cols = db.prepare('PRAGMA table_info(users)').all().map((r) => (r as { name: string }).name);
    expect(cols).toContain('monthly_token_limit');
    // v4 column present.
    const fileCols = db.prepare('PRAGMA table_info(file_library)').all().map((r) => (r as { name: string }).name);
    expect(fileCols).toContain('visibility');
  });

  it('re-running against an already-migrated DB is a clean no-op', () => {
    const db = mem();
    db.pragma('foreign_keys = ON');
    runMigrations(db, SCHEMA_MIGRATIONS);
    const res = runMigrations(db, SCHEMA_MIGRATIONS);
    expect(res.applied).toEqual([]);
    expect(res.skipped).toEqual(versions);
  });

  it('records exactly one ledger row per migration (no duplicates across runs)', () => {
    const db = mem();
    runMigrations(db, SCHEMA_MIGRATIONS);
    runMigrations(db, SCHEMA_MIGRATIONS);
    const count = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number };
    expect(count.n).toBe(SCHEMA_MIGRATIONS.length);
  });

  it('absorbs an existing pre-ledger DB: applies all migrations over a populated schema with no data loss', () => {
    const db = mem();
    db.pragma('foreign_keys = ON');

    // Simulate a production DB created BEFORE the migration ledger existed:
    // the baseline schema is present and has rows, but there is NO
    // schema_migrations table yet (initTables does not create one).
    initTables(db);
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('u1', 'alice', 'h', 'user')").run();
    expect(() => db.prepare('SELECT 1 FROM schema_migrations').get()).toThrow(); // ledger absent → truly pre-ledger

    // Upgrading: the runner creates the ledger, safely re-runs the idempotent
    // baseline + any incremental migrations over the populated schema, records
    // every version — no throw, no data loss.
    const res = runMigrations(db, SCHEMA_MIGRATIONS);
    expect(res.applied).toEqual(versions);
    expect(res.currentVersion).toBe(Math.max(...versions));
    const row = db.prepare('SELECT username FROM users WHERE id = ?').get('u1') as { username: string };
    expect(row.username).toBe('alice');
  });

  it('v4: migrates pre-existing files to team-visible, new rows default to private', () => {
    const db = mem();
    db.pragma('foreign_keys = ON');

    // Pre-ledger DB with a file already in the library (before visibility existed).
    initTables(db);
    db.prepare(
      `INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status)
       VALUES ('f1', 'old.pdf', 's1.pdf', 'application/pdf', 100, 'ready')`
    ).run();

    runMigrations(db, SCHEMA_MIGRATIONS);

    // The existing file is now team-visible (prior team-wide behaviour preserved).
    const existing = db.prepare('SELECT visibility FROM file_library WHERE id = ?').get('f1') as { visibility: string };
    expect(existing.visibility).toBe('team');

    // A brand-new row (no explicit visibility) defaults to private.
    db.prepare(
      `INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status)
       VALUES ('f2', 'new.pdf', 's2.pdf', 'application/pdf', 100, 'ready')`
    ).run();
    const fresh = db.prepare('SELECT visibility FROM file_library WHERE id = ?').get('f2') as { visibility: string };
    expect(fresh.visibility).toBe('private');
  });
});
