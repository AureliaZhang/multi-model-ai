import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest, UserPublic, CreateUserRequest, UpdateUserRequest } from '../types';

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
      SELECT id, username, email, phone, display_name as displayName, role,
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
 * POST /api/users
 * Create a new user (admin only)
 */
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, phone, displayName, role } = req.body as CreateUserRequest;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password are required' });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ success: false, error: 'Username must be 3-30 characters' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const db = getDb();

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ success: false, error: 'Username already exists' });
      return;
    }

    // Check email uniqueness if provided
    if (email) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (emailExists) {
        res.status(409).json({ success: false, error: 'Email already in use' });
        return;
      }
    }

    // Check phone uniqueness if provided
    if (phone) {
      const phoneExists = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (phoneExists) {
        res.status(409).json({ success: false, error: 'Phone number already in use' });
        return;
      }
    }

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'user';

    db.prepare(`
      INSERT INTO users (id, username, email, phone, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, email || null, phone || null, passwordHash, displayName || username, userRole);

    const user: UserPublic = {
      id,
      username,
      email: email || null,
      phone: phone || null,
      displayName: displayName || username,
      role: userRole,
      isActive: true,
      lastLogin: null,
      createdAt: new Date().toISOString(),
    };

    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    console.error('Create user error:', err);
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
      SELECT id, username, email, phone, display_name as displayName, role,
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
    const db = getDb();
    const userId = req.params.id;
    const { email, phone, displayName, role, isActive, password } = req.body as UpdateUserRequest;

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
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
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
      SELECT id, username, email, phone, display_name as displayName, role,
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
