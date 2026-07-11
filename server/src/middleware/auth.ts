import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../database';
import type { AuthRequest, UserPublic, UserRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'multi-model-ai-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
}

function getUserById(userId: string): UserPublic | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, username, email, display_name as displayName, role,
           is_active as isActive, last_login as lastLogin,
           created_at as createdAt
    FROM users WHERE id = ?
  `).get(userId) as any;

  if (!row) return null;

  return {
    ...row,
    isActive: Boolean(row.isActive),
  };
}

/**
 * Middleware that requires authentication.
 * Attaches user to req.user if valid token is provided.
 * Returns 401 if no token or invalid token.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { userId } = verifyToken(token);
    const user = getUserById(userId);

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, error: 'Account is disabled' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication middleware.
 * Attaches user to req.user if valid token is provided, but doesn't reject if missing.
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { userId } = verifyToken(token);
    const user = getUserById(userId);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}

/**
 * Middleware that requires specific roles.
 * Must be used after requireAuth.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/** requireAuth then admin role — use as router.use(...requireAdmin) or route middleware array */
export const requireAdmin = [requireAuth, requireRole('admin')];
