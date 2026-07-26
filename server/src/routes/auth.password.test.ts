import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS, flagDefaultAdminPasswords } from '../database';
import { applyPasswordChange } from './auth';

// Forced password change (v0.7.59, §10.9 P0 #2): migration v10 flag column,
// the boot sweep that flags admins still on the seeded default, and the
// change-password core used by the forced dialog.

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS); // incl. v10 users.must_change_password
  return db;
}

function insertUser(db: Database.Database, opts: { role?: string; password?: string; flagged?: number } = {}): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, must_change_password)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, `u-${id.slice(0, 8)}`, bcrypt.hashSync(opts.password ?? 'secret1', 4), opts.role ?? 'user', opts.flagged ?? 0);
  return id;
}

function flagOf(db: Database.Database, id: string): number {
  return (db.prepare('SELECT must_change_password AS f FROM users WHERE id = ?').get(id) as { f: number }).f;
}

describe('migration v10', () => {
  it('users gains must_change_password (default 0)', () => {
    const db = freshDb();
    const id = insertUser(db);
    expect(flagOf(db, id)).toBe(0);
    db.close();
  });
});

describe('flagDefaultAdminPasswords (boot sweep)', () => {
  it('flags an admin still on admin123; leaves custom-password admins and plain users alone', () => {
    const db = freshDb();
    const defaultAdmin = insertUser(db, { role: 'admin', password: 'admin123' });
    const safeAdmin = insertUser(db, { role: 'admin', password: 'S3cure!pass' });
    const defaultUser = insertUser(db, { role: 'user', password: 'admin123' });

    flagDefaultAdminPasswords(db);

    expect(flagOf(db, defaultAdmin)).toBe(1);
    expect(flagOf(db, safeAdmin)).toBe(0);
    expect(flagOf(db, defaultUser)).toBe(0); // only admins are swept
    db.close();
  });

  it('is idempotent (already-flagged rows are skipped)', () => {
    const db = freshDb();
    const id = insertUser(db, { role: 'admin', password: 'admin123', flagged: 1 });
    flagDefaultAdminPasswords(db);
    expect(flagOf(db, id)).toBe(1);
    db.close();
  });
});

describe('applyPasswordChange', () => {
  it('rejects wrong current password / short / unchanged new password', () => {
    const db = freshDb();
    const id = insertUser(db, { password: 'oldpass1', flagged: 1 });
    expect(applyPasswordChange(db, id, 'WRONG', 'newpass1')).toEqual({ ok: false, reason: 'wrong_password' });
    expect(applyPasswordChange(db, id, 'oldpass1', 'tiny')).toEqual({ ok: false, reason: 'too_short' });
    expect(applyPasswordChange(db, id, 'oldpass1', 'oldpass1')).toEqual({ ok: false, reason: 'same_password' });
    expect(applyPasswordChange(db, 'no-such-id', 'x', 'newpass1')).toEqual({ ok: false, reason: 'not_found' });
    expect(flagOf(db, id)).toBe(1); // failures never clear the flag
    db.close();
  });

  it('success rotates the hash and clears must_change_password', () => {
    const db = freshDb();
    const id = insertUser(db, { password: 'oldpass1', flagged: 1 });
    expect(applyPasswordChange(db, id, 'oldpass1', 'brand-new-pass')).toEqual({ ok: true });
    expect(flagOf(db, id)).toBe(0);
    const hash = (db.prepare('SELECT password_hash AS h FROM users WHERE id = ?').get(id) as { h: string }).h;
    expect(bcrypt.compareSync('brand-new-pass', hash)).toBe(true);
    expect(bcrypt.compareSync('oldpass1', hash)).toBe(false);
    // The boot sweep no longer flags it either
    flagDefaultAdminPasswords(db);
    expect(flagOf(db, id)).toBe(0);
    db.close();
  });
});
