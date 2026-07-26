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
  if (/no healthy stations available/.test(m)) return 'error.noStation';
  if (/quota|monthly token/.test(m)) return 'error.quota';
  if (/rate limit|too many requests|429/.test(m)) return 'error.rateLimit';
  if (/network error|failed to fetch|load failed|networkerror/.test(m)) return 'error.network';
  if (/timeout|timed out|aborted/.test(m)) return 'error.timeout';
  if (/unauthorized|authentication required|invalid token|jwt/.test(m)) return 'error.auth';
  return null;
}
