import { Router, Response } from 'express';
import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../types';
import type { UsageLogListRow, ModelPricingRow } from '../dbRows';
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
  /** Cost over this user's PRICED models (v0.7.54); null when nothing priced. */
  cost: number | null;
  /** True when the user also used models with no configured price (cost is a floor). */
  costIncomplete: boolean;
}
export interface UsageModelAgg {
  modelNormalized: string | null;
  requests: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  /** promptTokens/1M * promptPrice + completionTokens/1M * completionPrice; null = model not priced. */
  cost: number | null;
}
export interface UsageTotals {
  requests: number;
  tokens: number;
  errors: number;
  users: number;
  /** Sum over priced models only; null when no pricing configured at all. */
  cost: number | null;
  costIncomplete: boolean;
}

/** A model's configured unit prices (per 1M tokens, currency-agnostic). */
export interface ModelPricing {
  modelNormalized: string;
  promptPricePerM: number;
  completionPricePerM: number;
}

/** Cost of a (promptTokens, completionTokens) pair under a pricing row. Pure. */
export function computeCost(
  promptTokens: number,
  completionTokens: number,
  pricing: { promptPricePerM: number; completionPricePerM: number }
): number {
  return (promptTokens / 1_000_000) * pricing.promptPricePerM
    + (completionTokens / 1_000_000) * pricing.completionPricePerM;
}

/** Load the pricing table as a map keyed by normalized model name. */
export function loadPricingMap(db: Database.Database): Map<string, ModelPricing> {
  const rows = db.prepare('SELECT model_normalized, prompt_price_per_m, completion_price_per_m FROM model_pricing').all() as ModelPricingRow[];
  const map = new Map<string, ModelPricing>();
  for (const r of rows) {
    // A row with both prices at 0 counts as "not priced" (the admin never set it).
    if (r.prompt_price_per_m > 0 || r.completion_price_per_m > 0) {
      map.set(r.model_normalized, {
        modelNormalized: r.model_normalized,
        promptPricePerM: r.prompt_price_per_m,
        completionPricePerM: r.completion_price_per_m,
      });
    }
  }
  return map;
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

  // --- $ cost (v0.7.54): priced models only; never guess unpriced ones. ---
  const pricing = loadPricingMap(db);
  for (const m of byModel) {
    const p = m.modelNormalized ? pricing.get(m.modelNormalized) : undefined;
    m.cost = p ? computeCost(m.promptTokens, m.completionTokens, p) : null;
  }
  // Per-user cost needs the (user, model) split — one extra grouped query.
  const byUserModel = db.prepare(`
    SELECT user_id as userId, model_normalized as modelNormalized,
           ${okPrompt} as promptTokens,
           ${okCompletion} as completionTokens
    FROM api_usage_logs
    WHERE ${whereSql}
    GROUP BY user_id, model_normalized
  `).all(...params) as Array<{ userId: string | null; modelNormalized: string | null; promptTokens: number; completionTokens: number }>;
  const userCost = new Map<string | null, { cost: number; priced: boolean; unpriced: boolean }>();
  for (const um of byUserModel) {
    const acc = userCost.get(um.userId) || { cost: 0, priced: false, unpriced: false };
    const p = um.modelNormalized ? pricing.get(um.modelNormalized) : undefined;
    if (p) { acc.cost += computeCost(um.promptTokens, um.completionTokens, p); acc.priced = true; }
    else if (um.promptTokens > 0 || um.completionTokens > 0) { acc.unpriced = true; }
    userCost.set(um.userId, acc);
  }
  for (const u of byUser) {
    const acc = userCost.get(u.userId);
    u.cost = acc && acc.priced ? acc.cost : null;
    u.costIncomplete = Boolean(acc?.unpriced && acc?.priced);
  }
  const pricedModels = byModel.filter((m) => m.cost !== null);
  totals.cost = pricedModels.length ? pricedModels.reduce((sum, m) => sum + (m.cost as number), 0) : null;
  totals.costIncomplete = pricedModels.length > 0 && pricedModels.length < byModel.filter((m) => m.tokens > 0).length;

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

/**
 * GET /api/usage/pricing — every model that has ever appeared in the logs,
 * LEFT-JOINed with its configured unit prices (null prices = not configured).
 */
router.get('/pricing', (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT DISTINCT l.model_normalized as modelNormalized,
             p.prompt_price_per_m as promptPricePerM,
             p.completion_price_per_m as completionPricePerM
      FROM api_usage_logs l
      LEFT JOIN model_pricing p ON p.model_normalized = l.model_normalized
      WHERE l.model_normalized IS NOT NULL AND l.model_normalized != ''
      ORDER BY l.model_normalized
    `).all() as Array<{ modelNormalized: string; promptPricePerM: number | null; completionPricePerM: number | null }>;
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * PUT /api/usage/pricing/:model — upsert a model's unit prices (per 1M tokens).
 * Body: { promptPricePerM, completionPricePerM } — non-negative numbers.
 */
router.put('/pricing/:model', (req: AuthRequest, res: Response) => {
  try {
    const model = String(req.params.model || '').trim();
    if (!model) return res.status(400).json({ success: false, error: 'model is required' });
    const { promptPricePerM, completionPricePerM } = req.body as { promptPricePerM?: unknown; completionPricePerM?: unknown };
    const pp = Number(promptPricePerM);
    const cp = Number(completionPricePerM);
    if (!Number.isFinite(pp) || pp < 0 || !Number.isFinite(cp) || cp < 0) {
      return res.status(400).json({ success: false, error: 'Prices must be non-negative numbers (per 1M tokens)' });
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO model_pricing (model_normalized, prompt_price_per_m, completion_price_per_m, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(model_normalized) DO UPDATE SET
        prompt_price_per_m = excluded.prompt_price_per_m,
        completion_price_per_m = excluded.completion_price_per_m,
        updated_at = excluded.updated_at
    `).run(model, pp, cp);
    res.json({ success: true, data: { modelNormalized: model, promptPricePerM: pp, completionPricePerM: cp } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
