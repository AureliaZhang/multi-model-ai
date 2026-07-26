import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { generateToken, requireAuth } from '../middleware/auth';
import type { AuthRequest, RegisterRequest, LoginRequest, AuthResponse, UserPublic } from '../types';
import type { UserPublicRow } from '../dbRows';
import { getErrorMessage } from '../utils/errors';
import { isVirtualPlaceholderUser, VIRTUAL_PLACEHOLDER_USERNAME } from '../virtualUser';
import { requireInvite, getInviteByCode, validateInvite, consumeInvite } from '../services/invites';
import type { InviteRow } from '../dbRows';
import type { UserRole } from '../types';

const router = Router();

/** User-facing message per invite rejection reason. */
const INVITE_ERRORS: Record<string, string> = {
  not_found: 'Invalid invite code',
  revoked: 'This invite has been revoked',
  expired: 'This invite has expired',
  exhausted: 'This invite has already been used',
};

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, phone, displayName, inviteCode } = req.body as RegisterRequest;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password are required' });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ success: false, error: 'Username must be 3-30 characters' });
      return;
    }

    if (username === VIRTUAL_PLACEHOLDER_USERNAME || isVirtualPlaceholderUser({ username })) {
      res.status(400).json({ success: false, error: 'This username is reserved' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const db = getDb();

    // Member invites (§10.8 Phase 5 FE-B). A provided code must be valid; with
    // REQUIRE_INVITE=1 the code becomes mandatory (invite-only instance). The
    // invite is validated here but consumed only after the INSERT succeeds.
    let invite: InviteRow | undefined;
    const trimmedCode = typeof inviteCode === 'string' ? inviteCode.trim() : '';
    if (trimmedCode) {
      invite = getInviteByCode(db, trimmedCode);
      const check = validateInvite(invite);
      if (!check.ok) {
        res.status(400).json({ success: false, error: INVITE_ERRORS[check.reason] });
        return;
      }
    } else if (requireInvite()) {
      res.status(403).json({ success: false, error: 'Registration requires an invite code' });
      return;
    }

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
    // Role comes from the invite when one was used (e.g. an admin invite).
    const role: UserRole = invite && invite.role === 'admin' ? 'admin' : 'user';

    db.prepare(`
      INSERT INTO users (id, username, email, phone, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, email || null, phone || null, passwordHash, displayName || username, role);

    if (invite) consumeInvite(db, invite.id);

    const token = generateToken(id);

    const user: UserPublic = {
      id,
      username,
      email: email || null,
      phone: phone || null,
      displayName: displayName || username,
      role,
      isActive: true,
      lastLogin: null,
      createdAt: new Date().toISOString(),
    };

    const response: AuthResponse = { token, user };
    res.status(201).json({ success: true, data: response });
  } catch (err: unknown) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', (req: AuthRequest, res: Response) => {
  try {
    const { username, password, mode } = req.body as LoginRequest;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username/phone and password are required' });
      return;
    }

    const db = getDb();

    // Query by the specific field based on mode
    const query = mode === 'phone'
      ? `SELECT id, username, email, phone, password_hash as passwordHash,
                display_name as displayName, role,
                is_active as isActive, last_login as lastLogin,
                created_at as createdAt
         FROM users WHERE phone = ?`
      : `SELECT id, username, email, phone, password_hash as passwordHash,
                display_name as displayName, role,
                is_active as isActive, last_login as lastLogin,
                created_at as createdAt
         FROM users WHERE username = ?`;

    const row = db.prepare(query).get(username) as (UserPublicRow & { passwordHash: string }) | undefined;

    if (!row) {
      const errorMsg = mode === 'phone'
        ? 'Invalid phone number or password'
        : 'Invalid username or password';
      res.status(401).json({ success: false, error: errorMsg });
      return;
    }

    if (isVirtualPlaceholderUser(row)) {
      res.status(403).json({ success: false, error: 'This account is a system placeholder and cannot log in' });
      return;
    }

    if (!row.isActive) {
      res.status(403).json({ success: false, error: 'Account is disabled' });
      return;
    }

    const valid = bcrypt.compareSync(password, row.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid username/phone or password' });
      return;
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(row.id);

    const token = generateToken(row.id);

    const user: UserPublic = {
      id: row.id,
      username: row.username,
      email: row.email,
      phone: row.phone,
      displayName: row.displayName,
      role: row.role as UserPublic['role'],
      isActive: Boolean(row.isActive),
      lastLogin: new Date().toISOString(),
      createdAt: row.createdAt,
    };

    const response: AuthResponse = { token, user };
    res.json({ success: true, data: response });
  } catch (err: unknown) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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
