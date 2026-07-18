import { describe, it, expect } from 'vitest';
import {
  OCCUPANCY_MS,
  reconcileOccupancy,
  claimOccupancy,
  renewOccupancy,
  releaseOccupancy,
  beginAiTask,
  finishAiTask,
  type OccupancySnapshot,
} from './occupancy';

const T0 = Date.parse('2026-07-18T12:00:00.000Z');

function snap(partial: Partial<OccupancySnapshot> = {}): OccupancySnapshot {
  return {
    aiState: 'idle',
    occupantUserId: null,
    occupancyUntil: null,
    ...partial,
  };
}

describe('reconcileOccupancy', () => {
  it('leaves idle / ai_running untouched', () => {
    expect(reconcileOccupancy(snap(), T0)).toEqual(snap());
    const running = snap({ aiState: 'ai_running' });
    expect(reconcileOccupancy(running, T0)).toEqual(running);
  });

  it('keeps a still-valid occupying lock', () => {
    const current = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 60_000).toISOString(),
    });
    expect(reconcileOccupancy(current, T0)).toEqual(current);
  });

  it('expires a stale occupying lock back to idle', () => {
    const stale = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 - 1).toISOString(),
    });
    expect(reconcileOccupancy(stale, T0)).toEqual(snap());
  });
});

describe('claimOccupancy', () => {
  it('claims from idle', () => {
    const d = claimOccupancy(snap(), 'u1', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next.aiState).toBe('occupying_input');
    expect(d.next.occupantUserId).toBe('u1');
    expect(d.next.occupancyUntil).toBe(new Date(T0 + OCCUPANCY_MS).toISOString());
  });

  it('lets the same occupant re-claim (refresh)', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 10_000).toISOString(),
    });
    const d = claimOccupancy(held, 'u1', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next.occupantUserId).toBe('u1');
    expect(d.next.occupancyUntil).toBe(new Date(T0 + OCCUPANCY_MS).toISOString());
  });

  it('rejects another user while lock is held', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 60_000).toISOString(),
    });
    const d = claimOccupancy(held, 'u2', T0);
    expect(d).toEqual({
      ok: false,
      status: 409,
      error: 'Someone else is composing an @AI message',
    });
  });

  it('rejects while AI is running', () => {
    const d = claimOccupancy(snap({ aiState: 'ai_running' }), 'u1', T0);
    expect(d).toEqual({
      ok: false,
      status: 409,
      error: 'AI is replying; wait until it finishes',
    });
  });

  it('claims after a stale lock is reconciled', () => {
    const stale = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 - 1).toISOString(),
    });
    const d = claimOccupancy(stale, 'u2', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next.occupantUserId).toBe('u2');
  });
});

describe('renewOccupancy', () => {
  it('extends from now for the holder', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 30_000).toISOString(),
    });
    const d = renewOccupancy(held, 'u1', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next.occupancyUntil).toBe(new Date(T0 + OCCUPANCY_MS).toISOString());
  });

  it('rejects non-holder', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 30_000).toISOString(),
    });
    const d = renewOccupancy(held, 'u2', T0);
    expect(d.ok).toBe(false);
  });

  it('rejects when idle; allows holder even if until is past (matches rooms.ts)', () => {
    expect(renewOccupancy(snap(), 'u1', T0).ok).toBe(false);
    const expired = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 - 1).toISOString(),
    });
    const d = renewOccupancy(expired, 'u1', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next.occupancyUntil).toBe(new Date(T0 + OCCUPANCY_MS).toISOString());
  });
});

describe('releaseOccupancy', () => {
  it('clears the lock for the holder', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 30_000).toISOString(),
    });
    expect(releaseOccupancy(held, 'u1').next).toEqual(snap());
  });

  it('is a no-op for non-holders / idle / ai_running', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 30_000).toISOString(),
    });
    expect(releaseOccupancy(held, 'u2').next).toEqual(held);
    expect(releaseOccupancy(snap(), 'u1').next).toEqual(snap());
    const running = snap({ aiState: 'ai_running' });
    expect(releaseOccupancy(running, 'u1').next).toEqual(running);
  });
});

describe('beginAiTask / finishAiTask', () => {
  it('starts from idle (grab+start)', () => {
    const d = beginAiTask(snap(), 'u1', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next).toEqual({
      aiState: 'ai_running',
      occupantUserId: null,
      occupancyUntil: null,
    });
  });

  it('starts from holder occupying_input', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 30_000).toISOString(),
    });
    const d = beginAiTask(held, 'u1', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next.aiState).toBe('ai_running');
    expect(d.next.occupantUserId).toBeNull();
  });

  it('rejects another user while occupied', () => {
    const held = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 + 30_000).toISOString(),
    });
    const d = beginAiTask(held, 'u2', T0);
    expect(d).toEqual({
      ok: false,
      status: 409,
      error: 'Someone else holds the @AI lock',
    });
  });

  it('rejects while already ai_running', () => {
    const d = beginAiTask(snap({ aiState: 'ai_running' }), 'u1', T0);
    expect(d).toEqual({
      ok: false,
      status: 409,
      error: 'AI is already working on a task',
    });
  });

  it('starts after a stale lock expires', () => {
    const stale = snap({
      aiState: 'occupying_input',
      occupantUserId: 'u1',
      occupancyUntil: new Date(T0 - 1).toISOString(),
    });
    const d = beginAiTask(stale, 'u2', T0);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.next.aiState).toBe('ai_running');
  });

  it('finishAiTask always returns idle', () => {
    expect(finishAiTask(snap({ aiState: 'ai_running' }))).toEqual(snap());
    expect(finishAiTask(snap())).toEqual(snap());
  });

  it('full cycle: claim → renew → begin → finish', () => {
    let s = snap();
    const c = claimOccupancy(s, 'u1', T0);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    s = c.next;

    const r = renewOccupancy(s, 'u1', T0 + 30_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.next;

    const b = beginAiTask(s, 'u1', T0 + 40_000);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    s = b.next;
    expect(s.aiState).toBe('ai_running');

    s = finishAiTask(s);
    expect(s).toEqual(snap());

    // Another user can now claim.
    const c2 = claimOccupancy(s, 'u2', T0 + 50_000);
    expect(c2.ok).toBe(true);
  });
});
