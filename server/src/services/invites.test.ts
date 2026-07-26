import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { generateInviteCode, requireInvite, validateInvite, getInviteByCode, consumeInvite } from './invites';
import type { InviteRow } from '../dbRows';

// Member invites (§10.8 Phase 5 FE-B): migration v7 + the pure validation core
// consumed by /api/auth/register and the admin /api/users/invites endpoints.

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS); // full schema incl. migration v7 (invites)
  return db;
}

function insertInvite(db: Database.Database, opts: Partial<InviteRow> = {}): InviteRow {
  const id = opts.id || randomUUID();
  const code = opts.code || generateInviteCode();
  db.prepare(`
    INSERT INTO invites (id, code, role, created_by, max_uses, used_count, expires_at, revoked)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
  `).run(id, code, opts.role ?? 'user', opts.max_uses ?? 1, opts.used_count ?? 0, opts.expires_at ?? null, opts.revoked ?? 0);
  return db.prepare('SELECT * FROM invites WHERE id = ?').get(id) as InviteRow;
}

describe('generateInviteCode', () => {
  it('is URL-safe and collision-resistant enough to not repeat in a small sample', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBe(50);
    for (const c of codes) expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('requireInvite (env parse)', () => {
  it('defaults off; truthy values enable; explicit falsy values disable', () => {
    expect(requireInvite({})).toBe(false);
    expect(requireInvite({ REQUIRE_INVITE: '' })).toBe(false);
    expect(requireInvite({ REQUIRE_INVITE: '1' })).toBe(true);
    expect(requireInvite({ REQUIRE_INVITE: 'true' })).toBe(true);
    expect(requireInvite({ REQUIRE_INVITE: '0' })).toBe(false);
    expect(requireInvite({ REQUIRE_INVITE: 'off' })).toBe(false);
  });
});

describe('validateInvite', () => {
  const now = new Date('2026-07-26T12:00:00Z');
  const base: InviteRow = {
    id: 'i1', code: 'c1', role: 'user', created_by: null,
    max_uses: 1, used_count: 0, expires_at: null, revoked: 0, created_at: '2026-07-01 00:00:00',
  };

  it('accepts a fresh single-use invite; rejects a missing row', () => {
    expect(validateInvite(base, now)).toEqual({ ok: true });
    expect(validateInvite(undefined, now)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects revoked (and reports revoked even if also expired)', () => {
    expect(validateInvite({ ...base, revoked: 1 }, now)).toEqual({ ok: false, reason: 'revoked' });
    expect(validateInvite({ ...base, revoked: 1, expires_at: '2026-01-01T00:00:00.000Z' }, now))
      .toEqual({ ok: false, reason: 'revoked' });
  });

  it('rejects expired; a future expiry passes', () => {
    expect(validateInvite({ ...base, expires_at: '2026-07-26T11:59:59.000Z' }, now)).toEqual({ ok: false, reason: 'expired' });
    expect(validateInvite({ ...base, expires_at: '2026-08-01T00:00:00.000Z' }, now)).toEqual({ ok: true });
  });

  it('rejects exhausted; max_uses = 0 means unlimited', () => {
    expect(validateInvite({ ...base, max_uses: 1, used_count: 1 }, now)).toEqual({ ok: false, reason: 'exhausted' });
    expect(validateInvite({ ...base, max_uses: 3, used_count: 2 }, now)).toEqual({ ok: true });
    expect(validateInvite({ ...base, max_uses: 0, used_count: 9999 }, now)).toEqual({ ok: true });
  });
});

describe('invites table round-trip (migration v7)', () => {
  it('lookup by code + consume increments used_count until exhausted', () => {
    const db = freshDb();
    const invite = insertInvite(db, { max_uses: 2 });

    const found = getInviteByCode(db, invite.code);
    expect(found?.id).toBe(invite.id);
    expect(validateInvite(found)).toEqual({ ok: true });

    consumeInvite(db, invite.id);
    consumeInvite(db, invite.id);
    const spent = getInviteByCode(db, invite.code);
    expect(spent?.used_count).toBe(2);
    expect(validateInvite(spent)).toEqual({ ok: false, reason: 'exhausted' });
    db.close();
  });

  it('admin-role invites carry the role; revocation is a flag not a delete', () => {
    const db = freshDb();
    const invite = insertInvite(db, { role: 'admin' });
    expect(getInviteByCode(db, invite.code)?.role).toBe('admin');

    db.prepare('UPDATE invites SET revoked = 1 WHERE id = ?').run(invite.id);
    const revoked = getInviteByCode(db, invite.code);
    expect(revoked).toBeDefined(); // row survives for audit
    expect(validateInvite(revoked)).toEqual({ ok: false, reason: 'revoked' });
    db.close();
  });
});
