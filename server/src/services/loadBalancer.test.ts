import { describe, it, expect, beforeEach } from 'vitest';
import { roundRobin, _resetRoundRobin } from './loadBalancer';

type Pick = { station: { id: string }; label?: string };

function pick(id: string, label?: string): Pick {
  return { station: { id }, label };
}

describe('roundRobin', () => {
  beforeEach(() => {
    _resetRoundRobin();
  });

  it('returns a copy of an empty list', () => {
    const input: Pick[] = [];
    const out = roundRobin('m', input);
    expect(out).toEqual([]);
    expect(out).not.toBe(input);
  });

  it('returns a shallow copy for a single pick (no rotation)', () => {
    const input = [pick('s1')];
    const out = roundRobin('m', input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    // Counter should not matter — still the only element on next call.
    expect(roundRobin('m', input)[0].station.id).toBe('s1');
  });

  it('sorts by station id then rotates first element across calls', () => {
    const picks = [pick('c'), pick('a'), pick('b')]; // unsorted input
    const firsts = [
      roundRobin('m', picks)[0].station.id,
      roundRobin('m', picks)[0].station.id,
      roundRobin('m', picks)[0].station.id,
      roundRobin('m', picks)[0].station.id,
    ];
    // Stable order by id: a, b, c — then rotate start each call.
    expect(firsts).toEqual(['a', 'b', 'c', 'a']);
  });

  it('preserves the full list for failover (all ids present, same length)', () => {
    const picks = [pick('z'), pick('a'), pick('m')];
    const out = roundRobin('m', picks);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.station.id).sort()).toEqual(['a', 'm', 'z']);
  });

  it('keeps independent counters per key', () => {
    const picks = [pick('a'), pick('b')];
    expect(roundRobin('model-x', picks)[0].station.id).toBe('a');
    expect(roundRobin('model-x', picks)[0].station.id).toBe('b');
    // Different key starts fresh at sorted first.
    expect(roundRobin('model-y', picks)[0].station.id).toBe('a');
  });

  it('does not mutate the input array or its elements', () => {
    const picks = [pick('b', 'B'), pick('a', 'A')];
    const snapshot = picks.map((p) => p.station.id);
    roundRobin('m', picks);
    roundRobin('m', picks);
    expect(picks.map((p) => p.station.id)).toEqual(snapshot);
  });
});
