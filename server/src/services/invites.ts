/**
 * Member invites (§10.8 Phase 5 FE-B — "Member invite / onboarding").
 *
 * An admin mints an invite code (optionally expiring / multi-use / role-carrying)
 * and shares the link; registration with a valid code stamps the invite's role
 * onto the new account and consumes one use. Registration WITHOUT a code stays
 * open by default (existing behaviour); set `REQUIRE_INVITE=1` to make the
 * instance invite-only (the natural setting for a private team deployment).
 *
 * Pure validation logic lives here (unit-tested); the HTTP surface is
 * `routes/users.ts` (admin CRUD, `/api/users/invites`) + `routes/auth.ts`
 * (registration consumes codes).
 */

import { randomBytes } from 'crypto';
import type Database from 'better-sqlite3';
import type { InviteRow } from '../dbRows';

/** URL-safe invite code (no ambiguous chars to hand-copy; 24 chars ≈ 142 bits). */
export function generateInviteCode(): string {
  return randomBytes(18).toString('base64url');
}

/** Whether the instance refuses registration without a valid invite code. Pure. */
export function requireInvite(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REQUIRE_INVITE?.trim().toLowerCase();
  if (raw === undefined || raw === '') return false;
  return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off');
}

export type InviteRejection = 'not_found' | 'revoked' | 'expired' | 'exhausted';

/**
 * Validate an invite row against `now`. Pure — the row may be undefined (bad
 * code). Order matters for the user-facing message: revoked > expired >
 * exhausted (a revoked invite reports revoked even if also expired).
 */
export function validateInvite(
  row: InviteRow | undefined,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: InviteRejection } {
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.revoked) return { ok: false, reason: 'revoked' };
  if (row.expires_at && row.expires_at < now.toISOString()) return { ok: false, reason: 'expired' };
  if (row.max_uses > 0 && row.used_count >= row.max_uses) return { ok: false, reason: 'exhausted' };
  return { ok: true };
}

/** Look up an invite by code. */
export function getInviteByCode(db: Database.Database, code: string): InviteRow | undefined {
  return db.prepare('SELECT * FROM invites WHERE code = ?').get(code) as InviteRow | undefined;
}

/** Consume one use of an invite (call only after validateInvite passed). */
export function consumeInvite(db: Database.Database, id: string): void {
  db.prepare('UPDATE invites SET used_count = used_count + 1 WHERE id = ?').run(id);
}
