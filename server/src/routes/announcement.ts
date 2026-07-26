import { Router, Response } from 'express';
import { getDb } from '../database';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { getErrorMessage } from '../utils/errors';

const router = Router();

interface AnnouncementRow {
  content: string;
  enabled: number;
  updated_at: string;
}

/**
 * Admin announcement banner (§10.9 P2 #6, v0.7.63). One instance-wide message
 * the lead can broadcast; members dismiss per-version client-side (the
 * `updated_at` doubles as the version key for dismissals).
 */

// GET /api/announcement — visible to everyone incl. guests (it's a broadcast).
router.get('/', optionalAuth, (_req: AuthRequest, res: Response) => {
  try {
    const row = getDb().prepare('SELECT content, enabled, updated_at FROM announcement WHERE id = 1').get() as
      | AnnouncementRow
      | undefined;
    res.json({
      success: true,
      data: {
        content: row?.content || '',
        enabled: Boolean(row?.enabled),
        updatedAt: row?.updated_at || null,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/announcement — admin sets content + on/off. Saving new content
// bumps updated_at, which re-surfaces the banner for members who dismissed
// the previous version.
router.put('/', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { content, enabled } = req.body as { content?: unknown; enabled?: unknown };
    const db = getDb();
    const current = db.prepare('SELECT content, enabled FROM announcement WHERE id = 1').get() as
      | { content: string; enabled: number }
      | undefined;
    const newContent = typeof content === 'string' ? content.trim() : (current?.content ?? '');
    const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (current?.enabled ?? 0);
    db.prepare(
      "UPDATE announcement SET content = ?, enabled = ?, updated_by = ?, updated_at = datetime('now') WHERE id = 1"
    ).run(newContent, newEnabled, req.user!.id);
    const row = db.prepare('SELECT content, enabled, updated_at FROM announcement WHERE id = 1').get() as AnnouncementRow;
    res.json({ success: true, data: { content: row.content, enabled: Boolean(row.enabled), updatedAt: row.updated_at } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
