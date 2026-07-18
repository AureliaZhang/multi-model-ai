import { describe, it, expect, afterEach } from 'vitest';
import { mapPool, arenaConcurrency } from '../utils/asyncPool';

describe('mapPool', () => {
  it('returns empty for empty input', async () => {
    expect(await mapPool([], 3, async (x) => x)).toEqual([]);
  });

  it('preserves order even when later items finish first', async () => {
    const delays = [30, 5, 15];
    const started = Date.now();
    const out = await mapPool(delays, 3, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(out).toEqual([0, 1, 2]);
    expect(Date.now() - started).toBeLessThan(80); // parallel, not sum
  });

  it('caps concurrency (never more than N in flight)', async () => {
    let inflight = 0;
    let maxInflight = 0;
    await mapPool([1, 2, 3, 4, 5, 6], 2, async () => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 10));
      inflight -= 1;
      return true;
    });
    expect(maxInflight).toBeLessThanOrEqual(2);
    expect(maxInflight).toBe(2);
  });
});

describe('arenaConcurrency', () => {
  const prev = process.env.ARENA_CONCURRENCY;
  afterEach(() => {
    if (prev === undefined) delete process.env.ARENA_CONCURRENCY;
    else process.env.ARENA_CONCURRENCY = prev;
  });

  it('uses default when env unset / invalid', () => {
    delete process.env.ARENA_CONCURRENCY;
    expect(arenaConcurrency(3)).toBe(3);
    process.env.ARENA_CONCURRENCY = 'nope';
    expect(arenaConcurrency(4)).toBe(4);
  });

  it('clamps env to 1..16', () => {
    process.env.ARENA_CONCURRENCY = '8';
    expect(arenaConcurrency()).toBe(8);
    process.env.ARENA_CONCURRENCY = '99';
    expect(arenaConcurrency()).toBe(16);
    process.env.ARENA_CONCURRENCY = '0';
    expect(arenaConcurrency(3)).toBe(3);
  });
});
