import { Router, Response } from 'express';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { getErrorMessage } from '../utils/errors';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { readWebSearchConfig, webSearchAvailable } from '../services/webSearch';

const router = Router();

/**
 * In-chat web search config (v0.7.74). Admin sets provider key + switch;
 * members only learn whether the composer 联网 toggle is usable.
 */

router.use(requireAuth);

// GET /api/websearch/status — any member: can I use the toggle?
router.get('/status', (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: { available: webSearchAvailable(getDb()) } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/websearch/config — admin.
router.get('/config', requireRole('admin'), (_req: AuthRequest, res: Response) => {
  try {
    const cfg = readWebSearchConfig(getDb());
    res.json({
      success: true,
      data: {
        enabled: cfg?.enabled === 1,
        provider: cfg?.provider || 'tavily',
        apiKey: cfg?.api_key ? decryptSecret(cfg.api_key) : '',
        maxResults: cfg?.max_results ?? 3,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/websearch/config — admin. Key is encrypted at rest.
router.put('/config', requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { enabled, apiKey, maxResults } = req.body as {
      enabled?: unknown;
      apiKey?: unknown;
      maxResults?: unknown;
    };
    const db = getDb();
    const current = readWebSearchConfig(db);
    const newKey =
      apiKey !== undefined
        ? typeof apiKey === 'string' && apiKey.trim()
          ? encryptSecret(apiKey.trim())
          : null
        : (current?.api_key ?? null);
    const newMax =
      maxResults !== undefined && Number.isFinite(Number(maxResults))
        ? Math.min(8, Math.max(1, Math.trunc(Number(maxResults))))
        : (current?.max_results ?? 3);
    db.prepare(
      "UPDATE web_search_config SET enabled = ?, api_key = ?, max_results = ?, updated_at = datetime('now') WHERE id = 1"
    ).run(enabled !== undefined ? (enabled ? 1 : 0) : (current?.enabled ?? 0), newKey, newMax);
    const cfg = readWebSearchConfig(db);
    res.json({
      success: true,
      data: {
        enabled: cfg?.enabled === 1,
        provider: cfg?.provider || 'tavily',
        apiKey: cfg?.api_key ? decryptSecret(cfg.api_key) : '',
        maxResults: cfg?.max_results ?? 3,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
