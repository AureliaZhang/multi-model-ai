import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { pickSummaryModel, parseDigestResponse, summarizeKbFile } from './kbSummarizer';

// Team knowledge base (v0.7.65): migration v12 columns + the AI digest core
// (model pick, tolerant JSON parsing, and the full summarize flow with an
// injected model invoker — no network in tests).

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS); // incl. v12 kb/summary/doc_type/ai_keywords/summary_status
  return db;
}

function insertKbFile(db: Database.Database, text = '这是一份关于新能源补贴政策的文件全文内容。'): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status, kb, visibility)
    VALUES (?, '政策.pdf', 'x.pdf', 'application/pdf', 100, 'ready', 1, 'team')
  `).run(id);
  if (text) {
    db.prepare(`
      INSERT INTO file_chunks (id, file_id, chunk_index, content, token_count)
      VALUES (?, ?, 0, ?, 10)
    `).run(randomUUID(), id, text);
  }
  return id;
}

function rowOf(db: Database.Database, id: string) {
  return db.prepare('SELECT summary, doc_type, ai_keywords, summary_status FROM file_library WHERE id = ?').get(id) as {
    summary: string | null; doc_type: string | null; ai_keywords: string | null; summary_status: string;
  };
}

describe('migration v12', () => {
  it('file_library gains the kb + digest columns (defaults: kb=0, status none)', () => {
    const db = freshDb();
    const id = randomUUID();
    db.prepare(`INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status) VALUES (?, 'a', 'a', 'x', 1, 'ready')`).run(id);
    const row = db.prepare('SELECT kb, summary_status FROM file_library WHERE id = ?').get(id) as { kb: number; summary_status: string };
    expect(row.kb).toBe(0);
    expect(row.summary_status).toBe('none');
    db.close();
  });
});

describe('pickSummaryModel', () => {
  it('env override wins (normalized); else first enabled station model; else null', () => {
    const db = freshDb();
    expect(pickSummaryModel(db, { KB_SUMMARY_MODEL: 'GPT-4o' })).toBe(pickSummaryModel(db, { KB_SUMMARY_MODEL: 'gpt-4o' }));
    expect(pickSummaryModel(db, {})).toBeNull(); // no stations seeded in-memory
    const sid = randomUUID();
    db.prepare(`INSERT INTO stations (id, name, base_url, api_key, enabled) VALUES (?, 's', 'http://x', 'k', 1)`).run(sid);
    db.prepare(`INSERT INTO station_models (id, station_id, model_id, display_name, capabilities, enabled) VALUES (?, ?, 'deepseek-chat', 'd', '["text"]', 1)`).run(randomUUID(), sid);
    expect(pickSummaryModel(db, {})).toBeTruthy();
    db.close();
  });
});

describe('parseDigestResponse', () => {
  it('parses clean JSON, fenced JSON, and prose-wrapped JSON; caps keywords at 10', () => {
    const clean = parseDigestResponse('{"docType":"政策文件","keywords":["补贴","新能源"],"summary":"要点"}');
    expect(clean).toEqual({ docType: '政策文件', keywords: ['补贴', '新能源'], summary: '要点' });
    const fenced = parseDigestResponse('好的，以下是结果：\n```json\n{"type":"报告","keywords":["a"],"summary":"s"}\n```');
    expect(fenced?.docType).toBe('报告'); // tolerates "type" alias + fences + prose
    const many = parseDigestResponse(JSON.stringify({ docType: 't', keywords: Array.from({ length: 15 }, (_, i) => `k${i}`), summary: 's' }));
    expect(many?.keywords).toHaveLength(10);
  });

  it('rejects garbage / missing summary', () => {
    expect(parseDigestResponse('抱歉，我无法处理')).toBeNull();
    expect(parseDigestResponse('{"docType":"x","keywords":[]}')).toBeNull();
    expect(parseDigestResponse('')).toBeNull();
  });
});

function seedModel(db: Database.Database): void {
  const sid = randomUUID();
  db.prepare(`INSERT INTO stations (id, name, base_url, api_key, enabled) VALUES (?, 's', 'http://x', 'k', 1)`).run(sid);
  db.prepare(`INSERT INTO station_models (id, station_id, model_id, display_name, capabilities, enabled) VALUES (?, ?, 'deepseek-chat', 'd', '["text"]', 1)`).run(randomUUID(), sid);
}

describe('summarizeKbFile (injected invoker)', () => {
  const okInvoke = async () => ({
    ok: true as const,
    content: '{"docType":"政策文件","keywords":["新能源","补贴","2026"],"summary":"三句话要点。"}',
    modelUsed: 'm', stationId: 's', stationName: 'S', modelId: 'm', latencyMs: 5,
  });

  it('success path stores digest fields and flips status to ready', async () => {
    const db = freshDb();
    seedModel(db);
    const id = insertKbFile(db);
    const res = await summarizeKbFile(id, db, { invoke: okInvoke, log: () => {} });
    expect(res.ok).toBe(true);
    const row = rowOf(db, id);
    expect(row.summary_status).toBe('ready');
    expect(row.doc_type).toBe('政策文件');
    expect(JSON.parse(row.ai_keywords!)).toContain('补贴');
    db.close();
  });

  it('invoker failure / unparseable reply / empty text all land in status=error (never throws)', async () => {
    const db = freshDb();
    seedModel(db);
    const bad = insertKbFile(db);
    const res1 = await summarizeKbFile(bad, db, { invoke: async () => ({ ok: false as const, error: 'boom', latencyMs: 1, modelNormalizedName: 'm' }), log: () => {} });
    expect(res1.ok).toBe(false);
    expect(rowOf(db, bad).summary_status).toBe('error');

    const garbled = insertKbFile(db);
    const res2 = await summarizeKbFile(garbled, db, { invoke: async () => ({ ok: true as const, content: '呃……', modelUsed: 'm', stationId: 's', stationName: 'S', modelId: 'm', latencyMs: 1 }), log: () => {} });
    expect(res2).toEqual({ ok: false, reason: 'unparseable_digest' });

    const empty = insertKbFile(db, '');
    const res3 = await summarizeKbFile(empty, db, { invoke: okInvoke, log: () => {} });
    expect(res3).toEqual({ ok: false, reason: 'no_text' });
    db.close();
  });

  it('re-run regenerates in place (retry after error works)', async () => {
    const db = freshDb();
    seedModel(db);
    const id = insertKbFile(db);
    await summarizeKbFile(id, db, { invoke: async () => ({ ok: false as const, error: 'x', latencyMs: 1, modelNormalizedName: 'm' }), log: () => {} });
    expect(rowOf(db, id).summary_status).toBe('error');
    await summarizeKbFile(id, db, { invoke: okInvoke, log: () => {} });
    expect(rowOf(db, id).summary_status).toBe('ready');
    db.close();
  });
});
