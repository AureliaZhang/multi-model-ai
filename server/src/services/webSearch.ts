/**
 * In-chat web search (v0.7.74, owner batch #3 — 联网给新灵感). The member flips
 * a per-message 联网 toggle; the SERVER queries the configured search provider
 * and injects result snippets (+ sources) as system context, with an
 * instruction to cite links so the user can verify.
 *
 * Provider: Tavily (https://tavily.com — OpenAI-style JSON API with a free
 * tier). The admin pastes the key in Settings; it is encrypted at rest like
 * the embedding key. We use the provider's returned snippets/answer only — no
 * server-side fetching of arbitrary result URLs (that path stays behind the
 * SSRF-guarded KB url-import).
 *
 * Runtime note: needs egress to the provider — works once deployed; on the
 * offline dev VM the request itself fails by design (tests stub fetch).
 */

import type Database from 'better-sqlite3';
import { getDb } from '../database';
import { decryptSecret } from '../utils/crypto';
import { getErrorMessage } from '../utils/errors';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_SNIPPET_CHARS = 800;
const MAX_RESULTS_CAP = 8;

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface WebSearchConfigRow {
  enabled: number;
  provider: string;
  api_key: string | null;
  max_results: number;
}

export function readWebSearchConfig(db: Database.Database): WebSearchConfigRow | undefined {
  return db
    .prepare('SELECT enabled, provider, api_key, max_results FROM web_search_config WHERE id = 1')
    .get() as WebSearchConfigRow | undefined;
}

/** Is the feature usable for members right now? (switch on + key present) */
export function webSearchAvailable(db: Database.Database = getDb()): boolean {
  const cfg = readWebSearchConfig(db);
  return Boolean(cfg && cfg.enabled === 1 && cfg.api_key);
}

/**
 * Parse a Tavily-style response body. Tolerates missing fields and junk
 * items; also lifts the optional top-level "answer" into a pseudo-result.
 * Pure — unit-tested.
 */
export function parseTavilyResponse(json: unknown, maxResults = 3): WebSearchResult[] {
  if (!json || typeof json !== 'object') return [];
  const obj = json as { results?: unknown; answer?: unknown };
  const out: WebSearchResult[] = [];
  if (typeof obj.answer === 'string' && obj.answer.trim()) {
    out.push({ title: '综合回答 / Synthesized answer', url: '', content: obj.answer.trim().slice(0, MAX_SNIPPET_CHARS) });
  }
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (!item || typeof item !== 'object') continue;
      const r = item as { title?: unknown; url?: unknown; content?: unknown };
      const url = typeof r.url === 'string' ? r.url.trim() : '';
      const content = typeof r.content === 'string' ? r.content.trim() : '';
      if (!url || !content) continue;
      out.push({
        title: (typeof r.title === 'string' && r.title.trim()) || url,
        url,
        content: content.slice(0, MAX_SNIPPET_CHARS),
      });
      if (out.length >= Math.min(maxResults, MAX_RESULTS_CAP) + 1) break; // +1 slot covers the answer pseudo-result
    }
  }
  return out;
}

/** Render results as one system-context block with a cite-your-sources instruction. */
export function buildWebSearchContext(query: string, results: WebSearchResult[]): string | null {
  if (results.length === 0) return null;
  const body = results
    .map((r, i) => `${i + 1}. ${r.title}${r.url ? `\n   链接: ${r.url}` : ''}\n   ${r.content}`)
    .join('\n\n');
  return `用户开启了联网搜索。以下是围绕「${query}」刚刚检索到的网页结果，请结合这些最新信息回答；信息之间如有冲突以更权威/更新的为准。回答末尾请附一段「参考来源」，只列出你实际用到的链接：\n\n${body}`;
}

export interface WebSearchDeps {
  fetchImpl?: typeof fetch;
}

export type WebSearchOutcome =
  | { ok: true; results: WebSearchResult[] }
  | { ok: false; reason: string };

/** Query the configured provider. Never throws. */
export async function searchWeb(
  query: string,
  db: Database.Database = getDb(),
  deps: WebSearchDeps = {}
): Promise<WebSearchOutcome> {
  const cfg = readWebSearchConfig(db);
  if (!cfg || cfg.enabled !== 1) return { ok: false, reason: 'disabled' };
  if (!cfg.api_key) return { ok: false, reason: 'no_key' };
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, reason: 'empty_query' };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const maxResults = cfg.max_results > 0 ? Math.min(cfg.max_results, MAX_RESULTS_CAP) : 3;
  try {
    const res = await fetchImpl(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: decryptSecret(cfg.api_key),
        query: trimmed.slice(0, 400),
        max_results: maxResults,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const json = (await res.json()) as unknown;
    const results = parseTavilyResponse(json, maxResults);
    if (results.length === 0) return { ok: false, reason: 'no_results' };
    return { ok: true, results };
  } catch (err) {
    return { ok: false, reason: `fetch_failed: ${getErrorMessage(err)}` };
  }
}
