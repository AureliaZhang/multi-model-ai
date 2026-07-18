/**
 * Pure occupancy / @AI lock state machine for group rooms (§10.6.4 / §10.6.5).
 *
 * States: idle → occupying_input → ai_running → idle
 * Kept free of DB / Express so unit tests can drive every transition with a clock.
 * rooms.ts is the only writer; it maps DB rows ↔ OccupancySnapshot and persists `next`.
 */

export type AiState = 'idle' | 'occupying_input' | 'ai_running';

export interface OccupancySnapshot {
  aiState: AiState;
  occupantUserId: string | null;
  occupancyUntil: string | null; // ISO timestamp
}

/** Default @AI input lock duration — 2 minutes (§10.6.4). */
export const OCCUPANCY_MS = 2 * 60 * 1000;

export type OccupancyOk = { ok: true; next: OccupancySnapshot };
export type OccupancyDeny = { ok: false; status: 409; error: string };
export type OccupancyDecision = OccupancyOk | OccupancyDeny;

/**
 * Auto-release a stale input lock. ai_running is never auto-cleared here —
 * that only ends via finishAiTask after the model call completes.
 */
export function reconcileOccupancy(
  snap: OccupancySnapshot,
  nowMs: number
): OccupancySnapshot {
  if (snap.aiState === 'occupying_input' && snap.occupancyUntil) {
    if (new Date(snap.occupancyUntil).getTime() < nowMs) {
      return { aiState: 'idle', occupantUserId: null, occupancyUntil: null };
    }
  }
  return snap;
}

/** Claim (or re-claim by the same occupant) the @AI input lock. */
export function claimOccupancy(
  snap: OccupancySnapshot,
  userId: string,
  nowMs: number,
  durationMs: number = OCCUPANCY_MS
): OccupancyDecision {
  const current = reconcileOccupancy(snap, nowMs);
  if (current.aiState === 'ai_running') {
    return { ok: false, status: 409, error: 'AI is replying; wait until it finishes' };
  }
  if (current.aiState === 'occupying_input' && current.occupantUserId !== userId) {
    return { ok: false, status: 409, error: 'Someone else is composing an @AI message' };
  }
  return {
    ok: true,
    next: {
      aiState: 'occupying_input',
      occupantUserId: userId,
      occupancyUntil: new Date(nowMs + durationMs).toISOString(),
    },
  };
}

/** Occupant extends the lock by `durationMs` from now (not stacked on remaining). */
export function renewOccupancy(
  snap: OccupancySnapshot,
  userId: string,
  nowMs: number,
  durationMs: number = OCCUPANCY_MS
): OccupancyDecision {
  // Matches rooms.ts historical behaviour: renew checks holder identity only,
  // not wall-clock expiry. Stale locks are cleared by reconcile/claim, not renew.
  if (snap.aiState !== 'occupying_input' || snap.occupantUserId !== userId) {
    return { ok: false, status: 409, error: 'You do not hold the @AI lock' };
  }
  return {
    ok: true,
    next: {
      aiState: 'occupying_input',
      occupantUserId: userId,
      occupancyUntil: new Date(nowMs + durationMs).toISOString(),
    },
  };
}

/**
 * Occupant releases the lock. Non-occupants / idle / ai_running are no-ops that
 * still return ok (matches rooms.ts: release is idempotent for the HTTP path).
 */
export function releaseOccupancy(
  snap: OccupancySnapshot,
  userId: string
): OccupancyOk {
  if (snap.aiState === 'occupying_input' && snap.occupantUserId === userId) {
    return {
      ok: true,
      next: { aiState: 'idle', occupantUserId: null, occupancyUntil: null },
    };
  }
  return { ok: true, next: snap };
}

/**
 * Transition into ai_running before the model call.
 * Reconciles stale locks first. Caller may be idle (grab+start) or the occupant.
 */
export function beginAiTask(
  snap: OccupancySnapshot,
  userId: string,
  nowMs: number
): OccupancyDecision {
  const current = reconcileOccupancy(snap, nowMs);
  if (current.aiState === 'ai_running') {
    return { ok: false, status: 409, error: 'AI is already working on a task' };
  }
  if (current.aiState === 'occupying_input' && current.occupantUserId !== userId) {
    return { ok: false, status: 409, error: 'Someone else holds the @AI lock' };
  }
  return {
    ok: true,
    next: { aiState: 'ai_running', occupantUserId: null, occupancyUntil: null },
  };
}

/** After model success/failure — always back to idle. */
export function finishAiTask(_snap: OccupancySnapshot): OccupancySnapshot {
  return { aiState: 'idle', occupantUserId: null, occupancyUntil: null };
}
