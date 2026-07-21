import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { describe, it, expect, afterAll } from 'vitest';
import {
  parseBackupOptions,
  makeBackupFilename,
  pruneBackups,
  backupDatabaseTo,
  runBackupSweep,
  defaultBackupDir,
} from './backup';

const tmpDirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mmai-bkp-'));
  tmpDirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('parseBackupOptions', () => {
  it('defaults: enabled, daily interval, keep 7, backups/ beside the DB', () => {
    const o = parseBackupOptions({});
    expect(o.enabled).toBe(true);
    expect(o.intervalMs).toBe(24 * 60 * 60 * 1000);
    expect(o.keep).toBe(7);
    expect(o.dir).toBe(defaultBackupDir());
  });

  it('BACKUP_ENABLED falsy values disable the scheduled job', () => {
    for (const v of ['0', 'false', 'FALSE', 'no', 'off']) {
      expect(parseBackupOptions({ BACKUP_ENABLED: v }).enabled).toBe(false);
    }
    for (const v of ['1', 'true', 'yes', 'anything']) {
      expect(parseBackupOptions({ BACKUP_ENABLED: v }).enabled).toBe(true);
    }
  });

  it('honours BACKUP_DIR / BACKUP_INTERVAL_MS / BACKUP_KEEP', () => {
    const o = parseBackupOptions({ BACKUP_DIR: '/x/y', BACKUP_INTERVAL_MS: '1000', BACKUP_KEEP: '3' });
    expect(o.dir).toBe('/x/y');
    expect(o.intervalMs).toBe(1000);
    expect(o.keep).toBe(3);
  });

  it('falls back to defaults on invalid numeric env', () => {
    const o = parseBackupOptions({ BACKUP_INTERVAL_MS: 'nope', BACKUP_KEEP: '-4' });
    expect(o.intervalMs).toBe(24 * 60 * 60 * 1000);
    expect(o.keep).toBe(7);
  });

  it('BACKUP_KEEP=0 means keep all', () => {
    expect(parseBackupOptions({ BACKUP_KEEP: '0' }).keep).toBe(0);
  });
});

describe('makeBackupFilename', () => {
  it('formats app-YYYYMMDD-HHMMSS.db from an injected date', () => {
    expect(makeBackupFilename(new Date(2026, 0, 5, 9, 3, 7))).toBe('app-20260105-090307.db');
  });
});

describe('pruneBackups', () => {
  function seed(dir: string, names: string[]) {
    for (const n of names) fs.writeFileSync(path.join(dir, n), 'x');
  }

  it('keeps the newest N and deletes the rest (by timestamped name)', () => {
    const dir = tmp();
    seed(dir, [
      'app-20260101-000000.db',
      'app-20260102-000000.db',
      'app-20260103-000000.db',
      'app-20260104-000000.db',
      'app-20260105-000000.db',
    ]);
    const deleted = pruneBackups(dir, 2);
    expect(deleted.sort()).toEqual(['app-20260101-000000.db', 'app-20260102-000000.db', 'app-20260103-000000.db']);
    expect(fs.readdirSync(dir).sort()).toEqual(['app-20260104-000000.db', 'app-20260105-000000.db']);
  });

  it('ignores non-snapshot files and never deletes them', () => {
    const dir = tmp();
    seed(dir, ['app-20260101-000000.db', 'app-20260102-000000.db', 'app.db', 'notes.txt']);
    pruneBackups(dir, 1);
    const left = fs.readdirSync(dir).sort();
    expect(left).toContain('app.db');
    expect(left).toContain('notes.txt');
    expect(left).toContain('app-20260102-000000.db'); // newest snapshot kept
    expect(left).not.toContain('app-20260101-000000.db');
  });

  it('keep<=0 keeps everything; a missing dir is empty', () => {
    const dir = tmp();
    seed(dir, ['app-20260101-000000.db']);
    expect(pruneBackups(dir, 0)).toEqual([]);
    expect(fs.readdirSync(dir)).toHaveLength(1);
    expect(pruneBackups(path.join(dir, 'nope'), 3)).toEqual([]);
  });
});

describe('backupDatabaseTo (online snapshot round-trip)', () => {
  it('produces an openable copy with the source data', async () => {
    const dir = tmp();
    const srcPath = path.join(dir, 'src.db');
    const src = new Database(srcPath);
    src.pragma('journal_mode = WAL');
    src.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    src.prepare('INSERT INTO t (v) VALUES (?)').run('hello');

    const dest = path.join(dir, 'sub', 'snap.db'); // nested dir must be created
    await backupDatabaseTo(dest, src);
    src.close();

    expect(fs.existsSync(dest)).toBe(true);
    const copy = new Database(dest, { readonly: true });
    const row = copy.prepare('SELECT v FROM t WHERE id = 1').get() as { v: string };
    expect(row.v).toBe('hello');
    copy.close();
  });
});

describe('runBackupSweep', () => {
  it('writes a valid timestamped snapshot into opts.dir and prunes old ones', async () => {
    const dir = tmp();
    // pre-existing old snapshots to be pruned (keep=1)
    fs.writeFileSync(path.join(dir, 'app-20250101-000000.db'), 'x');
    fs.writeFileSync(path.join(dir, 'app-20250102-000000.db'), 'x');

    const src = new Database(':memory:');
    src.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    src.prepare('INSERT INTO t (id) VALUES (1)').run();

    const now = new Date(2026, 5, 1, 12, 0, 0);
    const { file, pruned } = await runBackupSweep({ enabled: true, dir, intervalMs: 1000, keep: 1 }, src, now);
    src.close();

    expect(path.basename(file)).toBe('app-20260601-120000.db');
    expect(fs.existsSync(file)).toBe(true);
    // both old ones pruned (only the fresh snapshot remains → keep 1)
    expect(pruned.sort()).toEqual(['app-20250101-000000.db', 'app-20250102-000000.db']);
    expect(fs.readdirSync(dir)).toEqual(['app-20260601-120000.db']);

    // and the snapshot is a real DB
    const copy = new Database(file, { readonly: true });
    expect((copy.prepare('SELECT COUNT(*) AS n FROM t').get() as { n: number }).n).toBe(1);
    copy.close();
  });
});
