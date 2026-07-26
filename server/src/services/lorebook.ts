/**
 * Project lorebook / 世界书 (v0.7.72) — SillyTavern-style World Info for a work
 * team. Entries are keyword-triggered: they cost no context until a recent
 * message mentions one of their keywords, then their content is injected as
 * system context. Matching is intentionally simple — case-insensitive
 * substring — because CJK has no word boundaries and the entries are curated
 * by the team, not adversarial input. All functions here are pure (unit-tested);
 * the route layer owns the DB.
 */

export interface LorebookEntry {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  enabled: boolean;
  priority: number;
  createdBy: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const LOREBOOK_LIMITS = {
  maxKeywords: 20,
  maxKeywordLen: 60,
  maxTitleLen: 120,
  maxContentLen: 4000,
  /** Total injected characters per message (keeps the context bill bounded). */
  injectBudgetChars: 2400,
  /** Hard cap on entries injected per message. */
  injectMaxEntries: 6,
} as const;

/**
 * Normalize a raw keywords input (array or comma/、-separated string) into a
 * clean list: trimmed, non-empty, deduped (case-insensitive), capped.
 */
export function parseLorebookKeywords(raw: unknown): string[] {
  let parts: string[] = [];
  if (Array.isArray(raw)) parts = raw.map((k) => String(k));
  else if (typeof raw === 'string') parts = raw.split(/[,，、\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.trim().slice(0, LOREBOOK_LIMITS.maxKeywordLen);
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
    if (out.length >= LOREBOOK_LIMITS.maxKeywords) break;
  }
  return out;
}

/** Validation for create/update payloads. Returns an error code or null. */
export function lorebookValidationError(e: {
  title?: unknown;
  content?: unknown;
  keywords?: string[];
}): string | null {
  const title = typeof e.title === 'string' ? e.title.trim() : '';
  const content = typeof e.content === 'string' ? e.content.trim() : '';
  if (!title) return 'title_required';
  if (title.length > LOREBOOK_LIMITS.maxTitleLen) return 'title_too_long';
  if (!content) return 'content_required';
  if (content.length > LOREBOOK_LIMITS.maxContentLen) return 'content_too_long';
  if (!e.keywords || e.keywords.length === 0) return 'keywords_required';
  return null;
}

/**
 * Which enabled entries fire for this scan text?
 * - case-insensitive substring match (CJK-safe; no word boundaries assumed)
 * - sorted by priority DESC, then most recently updated first
 * - bounded by injectMaxEntries and injectBudgetChars (the first matched entry
 *   is always included even if it alone exceeds the budget — an empty
 *   injection for a matched keyword would be more surprising than a long one)
 */
export function matchLorebookEntries(
  scanText: string,
  entries: LorebookEntry[],
  opts: { budgetChars?: number; maxEntries?: number } = {}
): LorebookEntry[] {
  const budget = opts.budgetChars ?? LOREBOOK_LIMITS.injectBudgetChars;
  const maxEntries = opts.maxEntries ?? LOREBOOK_LIMITS.injectMaxEntries;
  const haystack = scanText.toLowerCase();
  if (!haystack.trim()) return [];

  const matched = entries
    .filter(
      (e) =>
        e.enabled &&
        e.keywords.some((k) => {
          const needle = k.trim().toLowerCase();
          return needle.length > 0 && haystack.includes(needle);
        })
    )
    .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt));

  const out: LorebookEntry[] = [];
  let used = 0;
  for (const e of matched) {
    if (out.length >= maxEntries) break;
    const cost = e.title.length + e.content.length;
    if (out.length > 0 && used + cost > budget) continue;
    out.push(e);
    used += cost;
  }
  return out;
}

/** Render matched entries as one system-context block (zh-first, like the memory block). */
export function buildLorebookContext(matched: LorebookEntry[]): string | null {
  if (matched.length === 0) return null;
  const body = matched
    .map((e) => `【${e.title}】\n${e.content.trim()}`)
    .join('\n\n');
  return `以下是团队「项目世界书」中与当前话题相关的背景设定，请在回答时把它们当作既定事实遵循：\n${body}`;
}

/** Owner or admin may modify/delete an entry. */
export function canModifyLorebookEntry(
  entry: { createdBy: string | null },
  user: { id: string; role: string } | undefined
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return entry.createdBy != null && entry.createdBy === user.id;
}
