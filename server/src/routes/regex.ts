import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireAuth, optionalAuth } from '../middleware/auth';
import type { AuthRequest } from '../types';
import { testRegex } from '../services/regexEngine';

const router = Router();

// ============================================================
// Regex Scripts CRUD
// ============================================================

// GET /api/regex/scripts — List all scripts for current user
router.get('/scripts', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;

    // Admin can see all scripts; users see only their own
    let rows;
    if (req.user!.role === 'admin') {
      rows = db.prepare(`
        SELECT rs.*, u.username as owner_username
        FROM regex_scripts rs
        LEFT JOIN users u ON u.id = rs.user_id
        ORDER BY rs.user_id, rs.script_order ASC
      `).all();
    } else {
      rows = db.prepare(`
        SELECT * FROM regex_scripts WHERE user_id = ? ORDER BY script_order ASC
      `).all(userId);
    }

    const scripts = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      findPattern: r.find_pattern,
      replacement: r.replacement,
      flags: r.flags,
      placement: r.placement,
      enabled: r.enabled === 1,
      order: r.script_order,
      userId: r.user_id,
      ownerUsername: r.owner_username || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ success: true, data: scripts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/regex/scripts — Create a new script
router.post('/scripts', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { name, findPattern, replacement = '', flags = 'g', placement = 'both', enabled = true, order } = req.body;

    if (!name || !findPattern) {
      return res.status(400).json({ success: false, error: 'name and findPattern are required' });
    }

    // Validate regex
    try {
      new RegExp(findPattern, flags);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: `Invalid regex: ${e.message}` });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Get next order if not specified
    let scriptOrder = order;
    if (scriptOrder === undefined) {
      const maxRow = db.prepare(
        'SELECT MAX(script_order) as max_order FROM regex_scripts WHERE user_id = ?'
      ).get(userId) as any;
      scriptOrder = (maxRow?.max_order ?? -1) + 1;
    }

    db.prepare(`
      INSERT INTO regex_scripts (id, name, find_pattern, replacement, flags, placement, enabled, script_order, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, findPattern, replacement, flags, placement, enabled ? 1 : 0, scriptOrder, userId, now, now);

    res.json({
      success: true,
      data: { id, name, findPattern, replacement, flags, placement, enabled, order: scriptOrder, userId, createdAt: now, updatedAt: now },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/regex/scripts/:id — Update a script
router.put('/scripts/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { id } = req.params;

    // Check ownership or admin
    const existing = db.prepare('SELECT * FROM regex_scripts WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }
    if (existing.user_id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { name, findPattern, replacement, flags, placement, enabled, order } = req.body;

    // Validate regex if pattern changed
    const newPattern = findPattern ?? existing.find_pattern;
    const newFlags = flags ?? existing.flags;
    try {
      new RegExp(newPattern, newFlags);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: `Invalid regex: ${e.message}` });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE regex_scripts SET
        name = ?, find_pattern = ?, replacement = ?, flags = ?, placement = ?,
        enabled = ?, script_order = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      newPattern,
      replacement ?? existing.replacement,
      newFlags,
      placement ?? existing.placement,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      order ?? existing.script_order,
      now,
      id
    );

    res.json({ success: true, data: { id, updatedAt: now } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/regex/scripts/:id — Delete a script
router.delete('/scripts/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM regex_scripts WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }
    if (existing.user_id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    db.prepare('DELETE FROM regex_scripts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/regex/scripts/reorder — Reorder scripts
router.put('/scripts/reorder', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { ids } = req.body; // ordered array of script IDs

    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ids must be an array' });
    }

    const updateStmt = db.prepare('UPDATE regex_scripts SET script_order = ?, updated_at = ? WHERE id = ? AND (user_id = ? OR ? = ?)');
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      ids.forEach((scriptId: string, index: number) => {
        updateStmt.run(index, now, scriptId, userId, userId, userId);
      });
    });
    transaction();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Regex Presets CRUD
// ============================================================

// GET /api/regex/presets — List all presets for current user (with scripts)
router.get('/presets', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;

    let presetRows;
    if (req.user!.role === 'admin') {
      presetRows = db.prepare(`
        SELECT rp.*, u.username as owner_username
        FROM regex_presets rp
        LEFT JOIN users u ON u.id = rp.user_id
        ORDER BY rp.user_id, rp.created_at ASC
      `).all();
    } else {
      presetRows = db.prepare(`
        SELECT * FROM regex_presets WHERE user_id = ? ORDER BY created_at ASC
      `).all(userId);
    }

    const presets: any[] = (presetRows as any[]).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      userId: r.user_id,
      ownerUsername: r.owner_username || null,
      isDefault: r.is_default === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    // Load scripts for each preset
    for (const preset of presets) {
      const scriptRows = db.prepare(`
        SELECT rs.*, ps.script_order as "order"
        FROM regex_scripts rs
        JOIN preset_scripts ps ON ps.script_id = rs.id
        WHERE ps.preset_id = ?
        ORDER BY ps.script_order ASC
      `).all(preset.id) as any[];

      preset.scripts = scriptRows.map((r: any) => ({
        id: r.id,
        name: r.name,
        findPattern: r.find_pattern,
        replacement: r.replacement,
        flags: r.flags,
        placement: r.placement,
        enabled: r.enabled === 1,
        order: r.script_order ?? r.order ?? 0,
        userId: r.user_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }

    res.json({ success: true, data: presets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/regex/presets — Create a new preset
router.post('/presets', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { name, description, scriptIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO regex_presets (id, name, description, user_id, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `).run(id, name, description || null, userId, now, now);

      // Add scripts to preset
      if (Array.isArray(scriptIds) && scriptIds.length > 0) {
        const insertStmt = db.prepare(
          'INSERT INTO preset_scripts (preset_id, script_id, script_order) VALUES (?, ?, ?)'
        );
        scriptIds.forEach((scriptId: string, index: number) => {
          insertStmt.run(id, scriptId, index);
        });
      }
    });
    transaction();

    res.json({ success: true, data: { id, name, description: description || null, isDefault: false, createdAt: now, updatedAt: now } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/regex/presets/:id — Update preset metadata
router.put('/presets/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM regex_presets WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }
    if (existing.user_id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { name, description, isDefault } = req.body;
    const now = new Date().toISOString();

    // If setting as default, unset other defaults for this user
    if (isDefault === true) {
      db.prepare('UPDATE regex_presets SET is_default = 0 WHERE user_id = ?').run(existing.user_id);
    }

    db.prepare(`
      UPDATE regex_presets SET
        name = ?, description = ?, is_default = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      description !== undefined ? (description || null) : existing.description,
      isDefault !== undefined ? (isDefault ? 1 : 0) : existing.is_default,
      now,
      id
    );

    res.json({ success: true, data: { id, updatedAt: now } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/regex/presets/:id — Delete a preset
router.delete('/presets/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM regex_presets WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }
    if (existing.user_id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    db.prepare('DELETE FROM regex_presets WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/regex/presets/:id/scripts — Set scripts for a preset (full replacement)
router.post('/presets/:id/scripts', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { id } = req.params;
    const { scriptIds } = req.body;

    if (!Array.isArray(scriptIds)) {
      return res.status(400).json({ success: false, error: 'scriptIds must be an array' });
    }

    const existing = db.prepare('SELECT * FROM regex_presets WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }
    if (existing.user_id !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const transaction = db.transaction(() => {
      // Remove existing
      db.prepare('DELETE FROM preset_scripts WHERE preset_id = ?').run(id);
      // Add new
      const insertStmt = db.prepare(
        'INSERT INTO preset_scripts (preset_id, script_id, script_order) VALUES (?, ?, ?)'
      );
      scriptIds.forEach((scriptId: string, index: number) => {
        insertStmt.run(id, scriptId, index);
      });
      // Update preset timestamp
      db.prepare('UPDATE regex_presets SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    });
    transaction();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/regex/presets/:id/activate — Set active preset for a conversation
router.post('/presets/:id/activate', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { id: presetId } = req.params;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'conversationId is required' });
    }

    // Upsert
    db.prepare(`
      INSERT INTO conversation_preset (conversation_id, preset_id)
      VALUES (?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET preset_id = excluded.preset_id
    `).run(conversationId, presetId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/regex/presets/:id/export — Export preset + scripts as JSON
router.get('/presets/:id/export', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const preset = db.prepare('SELECT * FROM regex_presets WHERE id = ?').get(id) as any;
    if (!preset) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }

    const scriptRows = db.prepare(`
      SELECT rs.*, ps.script_order as "order"
      FROM regex_scripts rs
      JOIN preset_scripts ps ON ps.script_id = rs.id
      WHERE ps.preset_id = ?
      ORDER BY ps.script_order ASC
    `).all(id) as any[];

    const exportData = {
      version: 1,
      preset: {
        name: preset.name,
        description: preset.description,
      },
      scripts: scriptRows.map((r: any) => ({
        name: r.name,
        findPattern: r.find_pattern,
        replacement: r.replacement,
        flags: r.flags,
        placement: r.placement,
        enabled: r.enabled === 1,
        order: r.script_order ?? r.order ?? 0,
      })),
    };

    res.json({ success: true, data: exportData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/regex/import — Import preset + scripts from JSON
router.post('/import', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { version, preset: presetData, scripts: scriptData } = req.body;

    if (!presetData?.name || !Array.isArray(scriptData)) {
      return res.status(400).json({ success: false, error: 'Invalid import format' });
    }

    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      // Create preset
      const presetId = uuidv4();
      db.prepare(`
        INSERT INTO regex_presets (id, name, description, user_id, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `).run(presetId, presetData.name, presetData.description || null, userId, now, now);

      // Create scripts and link
      const insertScript = db.prepare(`
        INSERT INTO regex_scripts (id, name, find_pattern, replacement, flags, placement, enabled, script_order, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const linkScript = db.prepare(
        'INSERT INTO preset_scripts (preset_id, script_id, script_order) VALUES (?, ?, ?)'
      );

      for (const s of scriptData) {
        // Validate regex
        try {
          new RegExp(s.findPattern, s.flags);
        } catch {
          continue; // Skip invalid scripts
        }
        const scriptId = uuidv4();
        insertScript.run(
          scriptId, s.name, s.findPattern, s.replacement || '', s.flags || 'g',
          s.placement || 'both', s.enabled !== false ? 1 : 0, s.order || 0, userId, now, now
        );
        linkScript.run(presetId, scriptId, s.order || 0);
      }

      return presetId;
    });

    const presetId = transaction();
    res.json({ success: true, data: { id: presetId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/regex/test — Test regex on sample text
router.get('/test', (req: Request, res: Response) => {
  try {
    const { pattern, flags = 'g', replacement = '', text = '' } = req.query;

    if (!pattern) {
      return res.status(400).json({ success: false, error: 'pattern is required' });
    }

    const result = testRegex(
      pattern as string,
      flags as string,
      replacement as string,
      text as string
    );

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
