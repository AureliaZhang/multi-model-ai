import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import {
  shouldDistill,
  parseDistillResponse,
  distillConversation,
  DISTILL_TAG,
} from './memoryDistiller';
import type { InvokeModelResult } from './modelInvocation';

// Auto-distill learning (v0.7.73): cadence check, response parsing, and the
// full distill flow on an in-memory DB with stubbed invoke/log/embed.

describe('shouldDistill', () => {
  it('fires only when enabled and enough fresh messages accumulated', () => {
    const on = { autoSummarize: true, summarizeThreshold: 10 };
    expect(shouldDistill(on, 10, 0)).toBe(true);
    expect(shouldDistill(on, 9, 0)).toBe(false);
    expect(shouldDistill(on, 25, 16)).toBe(false);
    expect(shouldDistill(on, 26, 16)).toBe(true);
    expect(shouldDistill({ ...on, autoSummarize: false }, 100, 0)).toBe(false);
  });
  it('a zero/negative threshold falls back to the default (20)', () => {
    const cfg = { autoSummarize: true, summarizeThreshold: 0 };
    expect(shouldDistill(cfg, 19, 0)).toBe(false);
    expect(shouldDistill(cfg, 20, 0)).toBe(true);
  });
});

describe('parseDistillResponse', () => {
  it('extracts the JSON array from fences/prose, clamps and normalizes', () => {
    const raw = `好的，提炼如下：\n\`\`\`json\n[
      {"content": "客户A只接受周报形式汇报", "keywords": ["客户A", "周报"], "importance": 0.9},
      {"fact": "fact-field alias works", "importance": 4},
      {"content": "   "},
      {"content": "no keywords is fine"},
      "garbage",
      {"content": "importance out of range", "importance": 99}
    ]\n\`\`\``;
    const facts = parseDistillResponse(raw);
    expect(facts).toHaveLength(4);
    expect(facts[0]).toEqual({ content: '客户A只接受周报形式汇报', keywords: ['客户A', '周报'], importance: 0.9 });
    expect(facts[1].content).toBe('fact-field alias works');
    expect(facts[1].importance).toBeCloseTo(0.8); // 1-5 scale tolerated → 4/5
    expect(facts[2].keywords).toEqual([]);
    expect(facts[2].importance).toBe(0.5);
    expect(facts[3].importance).toBe(1); // clamped
  });
  it('returns [] for empty output, non-arrays and broken JSON', () => {
    expect(parseDistillResponse('')).toEqual([]);
    expect(parseDistillResponse('[]')).toEqual([]);
    expect(parseDistillResponse('没有值得记的内容')).toEqual([]);
    expect(parseDistillResponse('{"content": "an object, not an array"}')).toEqual([]);
    expect(parseDistillResponse('[{"content": broken]')).toEqual([]);
  });
  it('caps at 5 facts', () => {
    const many = JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ content: `fact ${i}` })));
    expect(parseDistillResponse(many)).toHaveLength(5);
  });
});

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS);
  db.prepare(`INSERT INTO stations (id, name, base_url, api_key, enabled) VALUES ('s1', 'S1', 'http://x', 'k', 1)`).run();
  db.prepare(`INSERT INTO station_models (id, station_id, model_id, display_name, capabilities, enabled) VALUES ('sm1', 's1', 'gpt-test', 'GPT Test', '["text"]', 1)`).run();
  db.prepare(`INSERT INTO users (id, username, password_hash, role) VALUES ('u1', 'lia', 'h', 'admin')`).run();
  db.prepare(`INSERT INTO conversations (id, title, model_normalized_name, user_id) VALUES ('c1', '项目讨论', 'gpt-test', 'u1')`).run();
  const ins = db.prepare(`INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, 'c1', ?, ?, ?)`);
  for (let i = 0; i < 6; i++) {
    ins.run(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', `消息 ${i}`, `2026-07-26T00:0${i}:00.000Z`);
  }
  return db;
}

const okInvoke = (content: string) =>
  async (): Promise<InvokeModelResult> => ({
    ok: true,
    content,
    modelUsed: 'gpt-test',
    stationId: 's1',
    stationName: 'S1',
    modelId: 'gpt-test',
    latencyMs: 5,
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  });

describe('distillConversation', () => {
  it('stores refined facts as memory entries (summary set, distilled tag, owner, embedding) and advances the watermark', async () => {
    const db = freshDb();
    const logged: unknown[] = [];
    const res = await distillConversation('c1', db, {
      invoke: okInvoke('[{"content": "团队决定周五上线", "keywords": ["上线"], "importance": 0.8}, {"content": "老板偏好简洁汇报"}]'),
      log: ((entry: unknown) => { logged.push(entry); }) as never,
      embed: async () => [1, 0, 0],
    });
    expect(res).toEqual({ ok: true, facts: 2 });

    const rows = db.prepare(`SELECT * FROM memory_entries ORDER BY created_at ASC`).all() as Array<{
      content: string; summary: string; tags: string; user_id: string; message_id: string; embedding: string | null; importance: number;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].content).toBe('团队决定周五上线');
    expect(rows[0].summary).toBe('团队决定周五上线'); // RAG injection reads summary
    expect(JSON.parse(rows[0].tags)).toEqual([DISTILL_TAG]);
    expect(rows[0].user_id).toBe('u1');
    expect(rows[0].message_id).toBe('m5'); // anchored to the newest covered message
    expect(rows[0].embedding).not.toBeNull();
    expect(rows[0].importance).toBeCloseTo(0.8);

    const conv = db.prepare(`SELECT distilled_message_count FROM conversations WHERE id = 'c1'`).get() as { distilled_message_count: number };
    expect(conv.distilled_message_count).toBe(6);
    expect(logged).toHaveLength(1); // usage logged once, under the owner

    const tag = db.prepare(`SELECT entry_count FROM memory_tags WHERE name = ?`).get(DISTILL_TAG) as { entry_count: number };
    expect(tag.entry_count).toBe(2);
    db.close();
  });

  it('advances the watermark even when the model finds nothing (no re-submit loop)', async () => {
    const db = freshDb();
    const res = await distillConversation('c1', db, {
      invoke: okInvoke('[]'),
      log: (() => {}) as never,
      embed: async () => null,
    });
    expect(res).toEqual({ ok: true, facts: 0 });
    const conv = db.prepare(`SELECT distilled_message_count FROM conversations WHERE id = 'c1'`).get() as { distilled_message_count: number };
    expect(conv.distilled_message_count).toBe(6);
    expect((db.prepare('SELECT COUNT(*) AS n FROM memory_entries').get() as { n: number }).n).toBe(0);
    db.close();
  });

  it('failed invocation leaves the watermark untouched so the tail is retried next round', async () => {
    const db = freshDb();
    const res = await distillConversation('c1', db, {
      invoke: async () => ({ ok: false as const, error: 'all stations down', latencyMs: 5, modelNormalizedName: 'gpt-test' }),
      log: (() => {}) as never,
      embed: async () => null,
    });
    expect(res.ok).toBe(false);
    const conv = db.prepare(`SELECT distilled_message_count FROM conversations WHERE id = 'c1'`).get() as { distilled_message_count: number };
    expect(conv.distilled_message_count).toBe(0);
    db.close();
  });

  it('refuses unknown conversations and ones with no fresh messages', async () => {
    const db = freshDb();
    expect((await distillConversation('nope', db, { invoke: okInvoke('[]'), log: (() => {}) as never })).ok).toBe(false);
    db.prepare(`UPDATE conversations SET distilled_message_count = 6 WHERE id = 'c1'`).run();
    const res = await distillConversation('c1', db, { invoke: okInvoke('[]'), log: (() => {}) as never });
    expect(res).toEqual({ ok: false, reason: 'no_new_messages' });
    db.close();
  });
});
