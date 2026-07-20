import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in ms. */
  windowMs: number;
  /** Max requests allowed per key per window. */
  max: number;
  /** Namespace so different mounts keep separate buckets (e.g. 'chat'). */
  key?: string;
  /** Injectable clock (tests). Defaults to Date.now. */
  now?: () => number;
}

/**
 * Minimal in-memory fixed-window rate limiter — no external dependency.
 * Keyed by authenticated user id when present, else client IP. Single-process
 * only (buckets live in this process's memory), which is sufficient for a small
 * self-hosted team deployment and avoids a Redis/store dependency.
 *
 * On limit: responds 429 with Retry-After; otherwise sets X-RateLimit-* headers
 * and calls next().
 */
export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max } = opts;
  const label = opts.key || 'default';
  const clock = opts.now || Date.now;
  const buckets = new Map<string, Bucket>();

  return function rateLimitMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    const now = clock();

    // Opportunistic cleanup so the map can't grow unbounded over a long uptime.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) {
        if (now >= b.resetAt) buckets.delete(k);
      }
    }

    const who = req.user?.id || req.ip || 'anon';
    const bucketKey = `${label}:${who}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }
    bucket.count++;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, error: `Too many requests — slow down and retry in ${retryAfter}s.` });
      return;
    }

    next();
  };
}
