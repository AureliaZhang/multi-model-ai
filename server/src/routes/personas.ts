import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireAuth } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { getErrorMessage } from '../utils/errors';
import type { PersonaLibraryRow } from '../dbRows';

const router = Router();

// The persona library is a TEAM-SHARED collection of reusable roles ("文案",
// "代码审查", "翻译"…). Every authenticated member may READ and USE any persona;
// only the creator (or an admin) may EDIT or DELETE one. This mirrors the
// ownership split used for files/memories in the Phase 1 isolation work.
router.use(requireAuth);

function rowToPersona(r: PersonaLibraryRow) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    description: r.description,
    createdBy: r.created_by,
    ownerUsername: r.owner_username || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Can the caller edit/delete this persona? Creator or admin only. Exported for tests. */
export function canModifyPersona(req: AuthRequest, row: PersonaLibraryRow): boolean {
  const u = req.user;
  if (!u) return false;
  return u.role === 'admin' || (row.created_by != null && row.created_by === u.id);
}

// GET /api/personas — team-shared list (everyone sees all)
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT p.*, u.username as owner_username
      FROM persona_library p
      LEFT JOIN users u ON u.id = p.created_by
      ORDER BY p.updated_at DESC
    `).all() as PersonaLibraryRow[];
    res.json({ success: true, data: rows.map(rowToPersona) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/personas — create a shared persona
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { title, body, description } = req.body as {
      title?: string;
      body?: string;
      description?: string;
    };
    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({ success: false, error: 'title and body are required' });
    }
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO persona_library (id, title, body, description, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, title.trim(), body.trim(), description?.trim() || null, req.user!.id, now, now);

    const row = db.prepare(`
      SELECT p.*, u.username as owner_username
      FROM persona_library p LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `).get(id) as PersonaLibraryRow;
    res.status(201).json({ success: true, data: rowToPersona(row) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/personas/:id — edit (creator/admin only)
router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM persona_library WHERE id = ?').get(id) as
      | PersonaLibraryRow
      | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Persona not found' });
    }
    if (!canModifyPersona(req, existing)) {
      return res.status(403).json({ success: false, error: 'You can only edit personas you created' });
    }

    const { title, body, description } = req.body as {
      title?: string;
      body?: string;
      description?: string;
    };
    const nextTitle = title !== undefined ? title.trim() : existing.title;
    const nextBody = body !== undefined ? body.trim() : existing.body;
    if (!nextTitle || !nextBody) {
      return res.status(400).json({ success: false, error: 'title and body cannot be empty' });
    }
    const nextDesc =
      description !== undefined ? (description.trim() || null) : existing.description;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE persona_library SET title = ?, body = ?, description = ?, updated_at = ? WHERE id = ?'
    ).run(nextTitle, nextBody, nextDesc, now, id);

    const row = db.prepare(`
      SELECT p.*, u.username as owner_username
      FROM persona_library p LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `).get(id) as PersonaLibraryRow;
    res.json({ success: true, data: rowToPersona(row) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// DELETE /api/personas/:id — delete (creator/admin only)
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM persona_library WHERE id = ?').get(id) as
      | PersonaLibraryRow
      | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Persona not found' });
    }
    if (!canModifyPersona(req, existing)) {
      return res.status(403).json({ success: false, error: 'You can only delete personas you created' });
    }
    db.prepare('DELETE FROM persona_library WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
