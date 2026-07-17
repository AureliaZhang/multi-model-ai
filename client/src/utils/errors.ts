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
