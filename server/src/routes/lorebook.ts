import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireAuth } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { getErrorMessage } from '../utils/errors';
import {
  parseLorebookKeywords,
  lorebookValidationError,
  canModifyLorebookEntry,
  LOREBOOK_LIMITS,
  type LorebookEntry,
} from '../services/lorebook';

const router = Router();

/**
 * Project lorebook / 世界书 routes (v0.7.72). Team philosophy mirrors the
 * knowledge base: every member can read everything and add entries; you can
 * edit/delete your own; admins can edit/delete/toggle anything.
 */

router.use(requireAuth);

interface LorebookRow {
  id: string;
  title: string;
  keywords: string;
  content: string;
  enabled: number;
  priority: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_ENTRY = `
  SELECT l.*, u.username AS created_by_name
  FROM lorebook_entries l LEFT JOIN users u ON u.id = l.created_by
`;

function rowToEntry(row: LorebookRow): LorebookEntry {
  return {
    id: row.id,
    title: row.title,
    keywords: JSON.parse(row.keywords || '[]') as string[],
    content: row.content,
    enabled: Boolean(row.enabled),
    priority: row.priority,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/lorebook — every member sees the whole book (it's team-shared).
router.get('/', (_req: AuthRequest, res: Response) => {
  try {
    const rows = getDb()
      .prepare(`${SELECT_ENTRY} ORDER BY l.priority DESC, l.updated_at DESC`)
      .all() as LorebookRow[];
    res.json({ success: true, data: rows.map(rowToEntry) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/lorebook — any member adds an entry.
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { title, content, keywords, priority } = req.body as {
      title?: unknown;
      content?: unknown;
      keywords?: unknown;
      priority?: unknown;
    };
    const kw = parseLorebookKeywords(keywords);
    const invalid = lorebookValidationError({ title, content, keywords: kw });
    if (invalid) return res.status(400).json({ success: false, error: invalid });

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO lorebook_entries (id, title, keywords, content, enabled, priority, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`
    ).run(
      id,
      String(title).trim().slice(0, LOREBOOK_LIMITS.maxTitleLen),
      JSON.stringify(kw),
      String(content).trim().slice(0, LOREBOOK_LIMITS.maxContentLen),
      Number.isFinite(Number(priority)) ? Math.trunc(Number(priority)) : 0,
      req.user!.id,
      now,
      now
    );
    const row = db.prepare(`${SELECT_ENTRY} WHERE l.id = ?`).get(id) as LorebookRow;
    res.status(201).json({ success: true, data: rowToEntry(row) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/lorebook/:id — owner edits own; admin edits anything (incl. enable/disable).
router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare(`${SELECT_ENTRY} WHERE l.id = ?`).get(req.params.id) as
      | LorebookRow
      | undefined;
    if (!existing) return res.status(404).json({ success: false, error: 'not_found' });
    if (!canModifyLorebookEntry({ createdBy: existing.created_by }, req.user)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    const { title, content, keywords, priority, enabled } = req.body as {
      title?: unknown;
      content?: unknown;
      keywords?: unknown;
      priority?: unknown;
      enabled?: unknown;
    };
    const newTitle =
      typeof title === 'string' ? title.trim().slice(0, LOREBOOK_LIMITS.maxTitleLen) : existing.title;
    const newContent =
      typeof content === 'string'
        ? content.trim().slice(0, LOREBOOK_LIMITS.maxContentLen)
        : existing.content;
    const newKw =
      keywords !== undefined ? parseLorebookKeywords(keywords) : (JSON.parse(existing.keywords || '[]') as string[]);
    const invalid = lorebookValidationError({ title: newTitle, content: newContent, keywords: newKw });
    if (invalid) return res.status(400).json({ success: false, error: invalid });

    db.prepare(
      `UPDATE lorebook_entries SET title = ?, keywords = ?, content = ?, priority = ?, enabled = ?, updated_at = ? WHERE id = ?`
    ).run(
      newTitle,
      JSON.stringify(newKw),
      newContent,
      priority !== undefined && Number.isFinite(Number(priority))
        ? Math.trunc(Number(priority))
        : existing.priority,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      new Date().toISOString(),
      req.params.id
    );
    const row = db.prepare(`${SELECT_ENTRY} WHERE l.id = ?`).get(req.params.id) as LorebookRow;
    res.json({ success: true, data: rowToEntry(row) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// DELETE /api/lorebook/:id — owner or admin.
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT created_by FROM lorebook_entries WHERE id = ?').get(req.params.id) as
      | { created_by: string | null }
      | undefined;
    if (!existing) return res.status(404).json({ success: false, error: 'not_found' });
    if (!canModifyLorebookEntry({ createdBy: existing.created_by }, req.user)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    db.prepare('DELETE FROM lorebook_entries WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
