import { describe, it, expect } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types';
import { rateLimit } from './rateLimit';

/** Minimal Response stub capturing status/headers/body. */
function mockRes() {
  const state = { headers: {} as Record<string, string>, statusCode: 0, body: undefined as unknown };
  const res = {
    setHeader(k: string, v: string) { state.headers[k] = v; },
    status(c: number) { state.statusCode = c; return res; },
    json(b: unknown) { state.body = b; return res; },
  };
  return { res: res as unknown as Response, state };
}

function reqFor(userId?: string, ip = '1.2.3.4'): AuthRequest {
  return { user: userId ? { id: userId } : undefined, ip } as unknown as AuthRequest;
}

describe('rateLimit middleware', () => {
  it('allows up to max, then 429s within the window', () => {
    const t = 1000;
    const mw = rateLimit({ windowMs: 60000, max: 3, now: () => t });
    const req = reqFor('u1');
    let nextCalls = 0;
    const next: NextFunction = () => { nextCalls++; };

    for (let i = 0; i < 3; i++) mw(req, mockRes().res, next);
    expect(nextCalls).toBe(3);

    const { res, state } = mockRes();
    mw(req, res, next);
    expect(nextCalls).toBe(3); // 4th blocked
    expect(state.statusCode).toBe(429);
    expect(state.headers['Retry-After']).toBeDefined();
  });

  it('resets after the window elapses', () => {
    let t = 0;
    const mw = rateLimit({ windowMs: 1000, max: 1, now: () => t });
    const req = reqFor('u1');
    let nextCalls = 0;
    const next: NextFunction = () => { nextCalls++; };

    mw(req, mockRes().res, next); // ok
    mw(req, mockRes().res, next); // blocked
    expect(nextCalls).toBe(1);

    t = 1001; // window passed
    mw(req, mockRes().res, next); // ok again
    expect(nextCalls).toBe(2);
  });

  it('keys separately per user (and falls back to IP when anonymous)', () => {
    const t = 5;
    const mw = rateLimit({ windowMs: 60000, max: 1, now: () => t });
    let nextCalls = 0;
    const next: NextFunction = () => { nextCalls++; };

    mw(reqFor('a'), mockRes().res, next);
    mw(reqFor('b'), mockRes().res, next);
    expect(nextCalls).toBe(2); // distinct users, each within limit

    // same anonymous IP shares a bucket → second is blocked
    const { state } = (() => { const m = mockRes(); mw(reqFor(undefined, '9.9.9.9'), m.res, next); return m; })();
    void state;
    const blocked = mockRes();
    mw(reqFor(undefined, '9.9.9.9'), blocked.res, next);
    expect(blocked.state.statusCode).toBe(429);
  });
});
