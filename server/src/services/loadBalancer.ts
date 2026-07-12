/**
 * Round-robin load balancer for stations serving a given model.
 *
 * Replaces the previous `Math.random()` picks. For each normalized model name
 * we keep an in-memory counter; every call rotates the (stably sorted) station
 * list so requests spread evenly across stations instead of clustering by luck.
 *
 * Callers still iterate the returned list in order for failover — the rotation
 * only changes which station is tried FIRST, so a down station simply falls
 * through to the next one as before.
 *
 * Notes / limits:
 * - In-memory: the counter resets on server restart. That is fine — round-robin
 *   only needs to be fair over time, not durable.
 * - Not persisted per-process-cluster. Single-process deployment (current) is
 *   exact; behind multiple workers each worker rotates independently, which is
 *   still well-distributed.
 */

const counters = new Map<string, number>();

/** Anything with a stable station id we can order by. */
interface HasStationId {
  station: { id: string };
}

/**
 * Return `picks` reordered for round-robin: stably sorted by station id, then
 * rotated by a per-model counter that advances on every call.
 *
 * @param key   Normalized model name (the counter is keyed on this).
 * @param picks Station candidates for the model (order-independent input).
 */
export function roundRobin<T extends HasStationId>(key: string, picks: T[]): T[] {
  if (picks.length <= 1) return picks.slice();

  // Stable order so the rotation index means the same thing across calls.
  const ordered = [...picks].sort((a, b) => a.station.id.localeCompare(b.station.id));

  const n = ordered.length;
  const start = (counters.get(key) ?? 0) % n;
  counters.set(key, start + 1); // advance for next request

  // Rotate: start at `start`, wrap around. Preserves full list for failover.
  return [...ordered.slice(start), ...ordered.slice(0, start)];
}

/** Test/debug helper: clear all counters. */
export function _resetRoundRobin(): void {
  counters.clear();
}
