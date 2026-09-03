import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../middleware/auth';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types';

describe('stations 路由权限守卫（v0.8.1）', () => {
  /**
   * 修复前：/api/stations 的 6 条路由（GET/POST/PUT/DELETE/enable/disable）都没挂
   * requireRole('admin')，普通用户可以读写全站配置、拿到所有 apiKey。
   *
   * 修复后：全部锁 admin-only。这里直接测 requireRole('admin') 中间件的行为。
   */
  describe('requireRole("admin") 拦截非 admin', () => {
    it('普通用户 → 403', () => {
      const req = { user: { id: 'u1', role: 'user' } } as AuthRequest;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requireRole('admin')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('admin → next()', () => {
      const req = { user: { id: 'u1', role: 'admin' } } as AuthRequest;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      requireRole('admin')(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('未登录（无 req.user）→ 401', () => {
      const req = {} as AuthRequest;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requireRole('admin')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
