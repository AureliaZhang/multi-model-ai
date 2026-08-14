/**
 * Safe error → string for catch (err: unknown) blocks.
 * Prefer this over `err: any` + `err.message`.
 */
export function getErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err == null) return fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err || fallback;
  if (typeof err === 'object') {
    const e = err as { message?: unknown; error?: unknown };
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.error === 'string' && e.error) return e.error;
  }
  try {
    const s = String(err);
    return s && s !== '[object Object]' ? s : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Map raw server/network error text to a friendly, actionable i18n key
 * (v0.7.64, §10.9 P2 #7). Returns null when no pattern matches — callers
 * fall back to the raw message. Pure & unit-tested.
 */
export function friendlyErrorKey(raw: string): string | null {
  const m = raw.toLowerCase();
  // The three "no station" states (v0.7.89) — checked before the generic
  // pattern below, and worded as "do this" rather than "wait and retry",
  // because none of them clears up on its own. Strings come from the server's
  // noStationMessage(); services/modelInvocation.ts is the other half of this
  // contract and is unit-tested against the same text.
  if (/is not enabled for use/.test(m)) return 'error.modelNotEnabled';
  if (/every station providing model .* is disabled/.test(m)) return 'error.stationDisabled';
  if (/no station provides model/.test(m)) return 'error.modelUnknown';
  if (/no healthy stations available/.test(m)) return 'error.noStation';
  // Upstream refused (v0.7.90) — the station was reachable in principle, the
  // provider said no. Distinct from the pool problems above: nothing to tick in
  // Settings, it's the key / URL / their service.
  if (/upstream rejected the credentials/.test(m)) return 'error.upstreamAuth';
  if (/upstream endpoint or model not found/.test(m)) return 'error.upstreamNotFound';
  if (/upstream rate limited/.test(m)) return 'error.upstreamRateLimited';
  if (/upstream returned a server error/.test(m)) return 'error.upstreamServerError';
  if (/could not reach any station/.test(m)) return 'error.upstreamUnreachable';
  if (/all stations failed/.test(m)) return 'error.allStationsFailed';
  if (/quota|monthly token/.test(m)) return 'error.quota';
  if (/rate limit|too many requests|429/.test(m)) return 'error.rateLimit';
  if (/network error|failed to fetch|load failed|networkerror/.test(m)) return 'error.network';
  if (/timeout|timed out|aborted/.test(m)) return 'error.timeout';
  if (/unauthorized|authentication required|invalid token|jwt/.test(m)) return 'error.auth';
  return null;
}
