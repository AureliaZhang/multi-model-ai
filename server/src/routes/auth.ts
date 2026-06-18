import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { generateToken, requireAuth } from '../middleware/auth';
import type { AuthRequest, RegisterRequest, LoginRequest, AuthResponse, UserPublic } from '../types';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, displayName } = req.body as RegisterRequest;

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

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?, 'user')
    `).run(id, username, email || null, passwordHash, displayName || username);

    const token = generateToken(id);

    const user: UserPublic = {
      id,
      username,
      email: email || null,
      displayName: displayName || username,
      role: 'user',
      isActive: true,
      lastLogin: null,
      createdAt: new Date().toISOString(),
    };

    const response: AuthResponse = { token, user };
    res.status(201).json({ success: true, data: response });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password are required' });
      return;
    }

    const db = getDb();

    const row = db.prepare(`
      SELECT id, username, email, password_hash as passwordHash,
             display_name as displayName, role,
             is_active as isActive, last_login as lastLogin,
             created_at as createdAt
      FROM users WHERE username = ?
    `).get(username) as any;

    if (!row) {
      res.status(401).json({ success: false, error: 'Invalid username or password' });
      return;
    }

    if (!row.isActive) {
      res.status(403).json({ success: false, error: 'Account is disabled' });
      return;
    }

    const valid = bcrypt.compareSync(password, row.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid username or password' });
      return;
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(row.id);

    const token = generateToken(row.id);

    const user: UserPublic = {
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      isActive: Boolean(row.isActive),
      lastLogin: new Date().toISOString(),
      createdAt: row.createdAt,
    };

    const response: AuthResponse = { token, user };
    res.json({ success: true, data: response });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: req.user });
});

export default router;
