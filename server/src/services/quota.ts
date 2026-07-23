/**
 * Per-user monthly token quota (§10.8 Phase 3 "control spend").
 *
 * Members get an optional monthly token cap (`users.monthly_token_limit`, added
 * in schema migration v2; 0 = unlimited). The chat path checks it before sending
 * and hard-blocks (HTTP 429) once the member has already consumed their cap this
 * calendar month. Admins are exempt (they set the limits).
 *
 * "This month" = from the 1st at 00:00 UTC, compared as ISO-8601 strings against
 * `api_usage_logs.created_at` (which is written as `new Date().toISOString()`),
 * so the lexicographic comparison is correct. Only successful (`status='ok'`)
 * rows count toward the cap.
 */

import type Database from 'better-sqlite3';

/** Start of the current UTC month as an ISO-8601 string (matches created_at format). */
export function monthStartISO(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Tokens this user has consumed (successful calls) since the start of this month. */
export function getUserMonthlyTokens(db: Database.Database, userId: string, now: Date = new Date()): number {
  const row = db.prepare(
    `SELECT COALESCE(SUM(total_tokens), 0) AS n
     FROM api_usage_logs
     WHERE user_id = ? AND status = 'ok' AND created_at >= ?`
  ).get(userId, monthStartISO(now)) as { n: number };
  return row.n;
}

/** This user's configured monthly cap (0 = unlimited). */
export function getUserMonthlyLimit(db: Database.Database, userId: string): number {
  const row = db.prepare('SELECT monthly_token_limit AS lim FROM users WHERE id = ?').get(userId) as
    | { lim: number | null }
    | undefined;
  return row?.lim ?? 0;
}

export interface QuotaStatus {
  /** Configured cap; 0 = unlimited. */
  limit: number;
  /** Tokens used this month. */
  used: number;
  /** Tokens remaining (Infinity when unlimited). */
  remaining: number;
  /** True when the member has hit or passed their cap and must be blocked. */
  exceeded: boolean;
}

/**
 * Evaluate a user's quota. Unlimited (`limit<=0`) short-circuits without a query.
 * `exceeded` uses already-consumed tokens (we can't know the pending request's
 * size up front), so a member at/over the cap is blocked on their next call.
 */
export function checkUserQuota(db: Database.Database, userId: string, now: Date = new Date()): QuotaStatus {
  const limit = getUserMonthlyLimit(db, userId);
  if (limit <= 0) return { limit: 0, used: 0, remaining: Infinity, exceeded: false };
  const used = getUserMonthlyTokens(db, userId, now);
  return { limit, used, remaining: Math.max(0, limit - used), exceeded: used >= limit };
}
