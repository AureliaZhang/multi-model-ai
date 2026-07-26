/**
 * Dependency-free HTML → readable text (v0.7.67 KB url-import). Not a browser-
 * grade parser — a pragmatic cleaner for articles/policy pages: drop script-ish
 * subtrees, turn block boundaries into newlines, strip tags, decode the common
 * entities, collapse whitespace. Pure — unit-tested.
 */

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', mdash: '—', ndash: '–', middot: '·',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
    })
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/** <title> content, entity-decoded and trimmed; null when absent/empty. */
export function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const t = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
  return t || null;
}

export function htmlToText(html: string): string {
  let s = html;
  // Drop non-content subtrees entirely.
  s = s.replace(/<(script|style|noscript|svg|iframe|head)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // Block-level boundaries become newlines so paragraphs survive tag-stripping.
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre|table)>/gi, '\n');
  s = s.replace(/<(br|hr)\s*\/?>/gi, '\n');
  // Headings get a blank line before them for markdown-ish reading rhythm.
  s = s.replace(/<h[1-6][^>]*>/gi, '\n\n');
  // Strip every remaining tag.
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  // Collapse: spaces/tabs within lines, ≤2 consecutive newlines overall.
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}
