/**
 * SSRF guard for server-side URL fetches (v0.7.67 KB url-import).
 *
 * A member-supplied URL is fetched BY THE SERVER, so without a guard a member
 * could point it at the server's own network (localhost admin panels, cloud
 * metadata endpoints, printers…). This blocks the obvious classes at the
 * hostname level. DNS-rebinding-grade attacks are out of scope for an internal
 * team tool — documented, not silently ignored.
 */

const PRIVATE_V4 = [
  /^127\./, // loopback
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local / cloud metadata
  /^0\./,
];

/**
 * Returns a rejection reason string, or null when the URL is acceptable.
 * Pure — unit-tested.
 */
export function urlRejectionReason(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'invalid_url';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'protocol';
  const host = url.hostname.toLowerCase();
  if (!host) return 'invalid_url';
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'private_host';
  }
  // IPv6 literal (URL keeps brackets off in .hostname for v6? Node strips brackets)
  if (host.includes(':')) {
    return 'private_host'; // conservatively refuse raw IPv6 literals (::1, fd00::/8, …)
  }
  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (PRIVATE_V4.some((re) => re.test(host))) return 'private_host';
  }
  return null;
}
