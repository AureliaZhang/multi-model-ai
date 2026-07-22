import { Router, Response } from 'express';
import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../types';
import type { UsageLogListRow } from '../dbRows';
import { getErrorMessage } from '../utils/errors';

const router = Router();
router.use(requireAuth, requireRole('admin'));

export interface UsageSummaryFilters {
  kind?: string;
  username?: string;
  from?: string;
  to?: string;
}
export interface UsageUserAgg {
  userId: string | null;
  username: string | null;
  requests: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  errors: number;
}
export interface UsageModelAgg {
  modelNormalized: string | null;
  requests: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
}
export interface UsageTotals {
  requests: number;
  tokens: number;
  errors: number;
  users: number;
}
export interface UsageSummary {
  byUser: UsageUserAgg[];
  byModel: UsageModelAgg[];
  totals: UsageTotals;
}

/**
 * Aggregate `api_usage_logs` for the admin dashboard (§10.8 Phase 3). Token-based
 * (no $ yet): per-user + per-model breakdowns and totals. Tokens are summed over
 * successful (`status='ok'`) rows only; `errors` counts the rest. Exported &
 * pure-ish (takes the db) so it is unit-testable and reusable by the quota check.
 *
 * NOTE: intentionally has no `status` filter — the aggregates compute ok-vs-error
 * themselves, so pre-filtering by status would zero out the error counts.
 */
export function computeUsageSummary(db: Database.Database, filters: UsageSummaryFilters = {}): UsageSummary {
  const where: string[] = ['1=1'];
  const params: (string | number)[] = [];
  if (filters.kind) { where.push('kind = ?'); params.push(filters.kind); }
  if (filters.username) { where.push('username LIKE ?'); params.push(`%${filters.username}%`); }
  if (filters.from) { where.push('created_at >= ?'); params.push(filters.from); }
  if (filters.to) { where.push('created_at <= ?'); params.push(filters.to); }
  const whereSql = where.join(' AND ');

  const okTokens = "COALESCE(SUM(CASE WHEN status = 'ok' THEN total_tokens ELSE 0 END), 0)";
  const okPrompt = "COALESCE(SUM(CASE WHEN status = 'ok' THEN prompt_tokens ELSE 0 END), 0)";
  const okCompletion = "COALESCE(SUM(CASE WHEN status = 'ok' THEN completion_tokens ELSE 0 END), 0)";
  const errCount = "COALESCE(SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END), 0)";

  const byUser = db.prepare(`
    SELECT user_id as userId, username,
           COUNT(*) as requests,
           ${okTokens} as tokens,
           ${okPrompt} as promptTokens,
           ${okCompletion} as completionTokens,
           ${errCount} as errors
    FROM api_usage_logs
    WHERE ${whereSql}
    GROUP BY user_id, username
    ORDER BY tokens DESC
  `).all(...params) as UsageUserAgg[];

  const byModel = db.prepare(`
    SELECT model_normalized as modelNormalized,
           COUNT(*) as requests,
           ${okTokens} as tokens,
           ${okPrompt} as promptTokens,
           ${okCompletion} as completionTokens
    FROM api_usage_logs
    WHERE ${whereSql}
    GROUP BY model_normalized
    ORDER BY tokens DESC
  `).all(...params) as UsageModelAgg[];

  const totals = db.prepare(`
    SELECT COUNT(*) as requests,
           ${okTokens} as tokens,
           ${errCount} as errors,
           COUNT(DISTINCT user_id) as users
    FROM api_usage_logs
    WHERE ${whereSql}
  `).get(...params) as UsageTotals;

  return { byUser, byModel, totals };
}


/**
 * GET /api/usage?limit=&offset=&status=&kind=&username=&from=&to=
 */
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset || '0'), 10) || 0;
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
    const username = typeof req.query.username === 'string' ? req.query.username : '';
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';

    const where: string[] = ['1=1'];
    const params: (string | number)[] = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (kind) {
      where.push('kind = ?');
      params.push(kind);
    }
    if (username) {
      where.push('username LIKE ?');
      params.push(`%${username}%`);
    }
    if (from) {
      where.push('created_at >= ?');
      params.push(from);
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(to);
    }

    const whereSql = where.join(' AND ');
    const total = (
      db.prepare(`SELECT COUNT(*) as n FROM api_usage_logs WHERE ${whereSql}`).get(...params) as { n: number }
    ).n;

    const rows = db.prepare(`
      SELECT id, user_id as userId, username, role, kind,
             model_normalized as modelNormalized, model_used as modelUsed,
             station_id as stationId, station_name as stationName,
             conversation_id as conversationId, status, http_status as httpStatus,
             error_message as errorMessage,
             prompt_tokens as promptTokens, completion_tokens as completionTokens,
             total_tokens as totalTokens, latency_ms as latencyMs, created_at as createdAt
      FROM api_usage_logs
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as UsageLogListRow[];

    const errorCount = (
      db.prepare(
        `SELECT COUNT(*) as n FROM api_usage_logs WHERE ${whereSql} AND status != 'ok'`
      ).get(...params) as { n: number }
    ).n;

    const sumTokens = (
      db.prepare(
        `SELECT COALESCE(SUM(total_tokens), 0) as n FROM api_usage_logs WHERE ${whereSql} AND status = 'ok'`
      ).get(...params) as { n: number }
    ).n;

    res.json({
      success: true,
      data: {
        items: rows,
        total,
        limit,
        offset,
        summary: {
          errors: errorCount,
          totalTokens: sumTokens,
        },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/usage/summary?from=&to=&kind=&username=
 * Aggregated usage for the admin dashboard (§10.8 Phase 3 "see spend").
 */
router.get('/summary', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const summary = computeUsageSummary(db, {
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
      username: typeof req.query.username === 'string' ? req.query.username : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
    });
    res.json({ success: true, data: summary });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
