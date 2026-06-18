import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest, UserPublic, UpdateUserRequest } from '../types';

const router = Router();

// All user management routes require admin role
router.use(requireAuth);
router.use(requireRole('admin'));

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, username, email, display_name as displayName, role,
             is_active as isActive, last_login as lastLogin,
             created_at as createdAt, updated_at as updatedAt
      FROM users ORDER BY created_at DESC
    `).all() as any[];

    const users: UserPublic[] = rows.map(row => ({
      ...row,
      isActive: Boolean(row.isActive),
    }));

    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/users/:id
 * Get a specific user (admin only)
 */
router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, username, email, display_name as displayName, role,
             is_active as isActive, last_login as lastLogin,
             created_at as createdAt
      FROM users WHERE id = ?
    `).get(req.params.id) as any;

    if (!row) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: { ...row, isActive: Boolean(row.isActive) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/users/:id
 * Update a user (admin only)
 */
router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { email, displayName, role, isActive, password } = req.body as UpdateUserRequest;
    const db = getDb();
    const userId = req.params.id;

    // Check user exists
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Prevent admin from deactivating themselves
    if (req.user?.id === userId && isActive === false) {
      res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
      return;
    }

    // Prevent admin from changing their own role
    if (req.user?.id === userId && role && role !== 'admin') {
      res.status(400).json({ success: false, error: 'Cannot change your own admin role' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (displayName !== undefined) { updates.push('display_name = ?'); values.push(displayName); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (password) { updates.push('password_hash = ?'); values.push(bcrypt.hashSync(password, 10)); }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }

    updates.push("updated_at = datetime('now')");
    values.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare(`
      SELECT id, username, email, display_name as displayName, role,
             is_active as isActive, last_login as lastLogin,
             created_at as createdAt
      FROM users WHERE id = ?
    `).get(userId) as any;

    res.json({ success: true, data: { ...row, isActive: Boolean(row.isActive) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user (admin only)
 */
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (req.user?.id === userId) {
      res.status(400).json({ success: false, error: 'Cannot delete your own account' });
      return;
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: { message: 'User deleted' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
