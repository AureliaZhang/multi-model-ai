import { Router, Response } from 'express';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { getErrorMessage } from '../utils/errors';

const router = Router();
router.use(requireAuth, requireRole('admin'));

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
    const params: any[] = [];
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
      db.prepare(`SELECT COUNT(*) as n FROM api_usage_logs WHERE ${whereSql}`).get(...params) as any
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
    `).all(...params, limit, offset);

    const errorCount = (
      db.prepare(
        `SELECT COUNT(*) as n FROM api_usage_logs WHERE ${whereSql} AND status != 'ok'`
      ).get(...params) as any
    ).n;

    const sumTokens = (
      db.prepare(
        `SELECT COALESCE(SUM(total_tokens), 0) as n FROM api_usage_logs WHERE ${whereSql} AND status = 'ok'`
      ).get(...params) as any
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

export default router;
