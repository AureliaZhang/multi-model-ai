import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { encryptSecret } from '../utils/crypto';
import {
  parseTavilyResponse,
  buildWebSearchContext,
  webSearchAvailable,
  searchWeb,
} from './webSearch';

// In-chat web search (v0.7.74): migration v15 defaults, response parsing,
// availability gate, and the search flow with a stubbed fetch (no network).

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS);
  return db;
}

function enable(db: Database.Database, key = 'tvly-test-key') {
  db.prepare('UPDATE web_search_config SET enabled = 1, api_key = ? WHERE id = 1').run(encryptSecret(key));
}

const TAVILY_BODY = {
  answer: '2026 年补贴政策已延长至年底。',
  results: [
    { title: '政策原文', url: 'https://www.gov.cn/a', content: '通知全文……' },
    { url: 'https://news.example.com/b', content: '解读文章内容' }, // no title → url used
    { title: 'junk-no-url', content: 'x' },
    'garbage',
  ],
};

function stubFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status < 400, status, json: async () => body };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('migration v15 + webSearchAvailable', () => {
  it('config row exists, disabled by default; available only with switch AND key', () => {
    const db = freshDb();
    expect(webSearchAvailable(db)).toBe(false);
    db.prepare('UPDATE web_search_config SET enabled = 1 WHERE id = 1').run(); // no key yet
    expect(webSearchAvailable(db)).toBe(false);
    enable(db);
    expect(webSearchAvailable(db)).toBe(true);
    db.close();
  });
});

describe('parseTavilyResponse', () => {
  it('lifts the answer, keeps valid results, drops junk, falls back to url as title', () => {
    const results = parseTavilyResponse(TAVILY_BODY, 3);
    expect(results[0].content).toContain('延长至年底');
    expect(results[0].url).toBe('');
    expect(results[1]).toMatchObject({ title: '政策原文', url: 'https://www.gov.cn/a' });
    expect(results[2].title).toBe('https://news.example.com/b');
    expect(results).toHaveLength(3); // junk items dropped
  });
  it('handles garbage bodies', () => {
    expect(parseTavilyResponse(null)).toEqual([]);
    expect(parseTavilyResponse('nope')).toEqual([]);
    expect(parseTavilyResponse({ results: 'not-an-array' })).toEqual([]);
  });
});

describe('buildWebSearchContext', () => {
  it('frames query + numbered sources + cite instruction; null when empty', () => {
    expect(buildWebSearchContext('q', [])).toBeNull();
    const ctx = buildWebSearchContext('新能源补贴', parseTavilyResponse(TAVILY_BODY, 3));
    expect(ctx).toContain('新能源补贴');
    expect(ctx).toContain('参考来源');
    expect(ctx).toContain('https://www.gov.cn/a');
  });
});

describe('searchWeb', () => {
  it('refuses when disabled / keyless / empty query without touching the network', async () => {
    const db = freshDb();
    const { impl, calls } = stubFetch(TAVILY_BODY);
    expect(await searchWeb('q', db, { fetchImpl: impl })).toEqual({ ok: false, reason: 'disabled' });
    db.prepare('UPDATE web_search_config SET enabled = 1 WHERE id = 1').run();
    expect(await searchWeb('q', db, { fetchImpl: impl })).toEqual({ ok: false, reason: 'no_key' });
    enable(db);
    expect(await searchWeb('   ', db, { fetchImpl: impl })).toEqual({ ok: false, reason: 'empty_query' });
    expect(calls).toHaveLength(0);
    db.close();
  });

  it('happy path: decrypted key + query posted to the provider, parsed results returned', async () => {
    const db = freshDb();
    enable(db, 'tvly-secret');
    const { impl, calls } = stubFetch(TAVILY_BODY);
    const res = await searchWeb('新能源补贴延长了吗', db, { fetchImpl: impl });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.results.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    const sent = JSON.parse(String(calls[0].init.body)) as { api_key: string; query: string; max_results: number };
    expect(sent.api_key).toBe('tvly-secret'); // decrypted before sending
    expect(sent.query).toContain('新能源');
    expect(sent.max_results).toBe(3);
    db.close();
  });

  it('provider errors and empty results are reported, not thrown', async () => {
    const db = freshDb();
    enable(db);
    expect(await searchWeb('q', db, { fetchImpl: stubFetch({}, 401).impl })).toEqual({ ok: false, reason: 'http_401' });
    expect(await searchWeb('q', db, { fetchImpl: stubFetch({ results: [] }).impl })).toEqual({ ok: false, reason: 'no_results' });
    const throwing = (async () => { throw new Error('offline dev VM'); }) as unknown as typeof fetch;
    const failed = await searchWeb('q', db, { fetchImpl: throwing });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.reason).toContain('fetch_failed');
    db.close();
  });
});
