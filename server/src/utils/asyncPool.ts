/**
 * Run async mapper over items with a fixed concurrency limit.
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/** Shared Arena concurrency (relay rate-limit friendly). Override with ARENA_CONCURRENCY. */
export function arenaConcurrency(defaultN = 3): number {
  const n = parseInt(process.env.ARENA_CONCURRENCY || String(defaultN), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16) : defaultN;
}
