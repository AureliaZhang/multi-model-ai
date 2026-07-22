import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { computeUsageSummary } from './usage';

function seed(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE api_usage_logs (
      id TEXT PRIMARY KEY, user_id TEXT, username TEXT, kind TEXT,
      model_normalized TEXT, status TEXT NOT NULL DEFAULT 'ok',
      prompt_tokens INTEGER, completion_tokens INTEGER, total_tokens INTEGER,
      created_at TEXT
    );
  `);
  const ins = db.prepare(`INSERT INTO api_usage_logs
    (id, user_id, username, kind, model_normalized, status, prompt_tokens, completion_tokens, total_tokens, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  ins.run('1', 'u1', 'alice', 'chat', 'gpt', 'ok', 10, 20, 30, '2026-07-01');
  ins.run('2', 'u1', 'alice', 'chat', 'gpt', 'ok', 5, 15, 20, '2026-07-02');
  ins.run('3', 'u1', 'alice', 'chat', 'claude', 'error', 0, 0, 0, '2026-07-03');
  ins.run('4', 'u2', 'bob', 'chat', 'gpt', 'ok', 100, 100, 200, '2026-07-04');
  return db;
}

describe('computeUsageSummary', () => {
  let db: Database.Database;
  beforeEach(() => { db = seed(); });

  it('aggregates per user (tokens over ok rows only; errors counted; sorted by tokens desc)', () => {
    const { byUser } = computeUsageSummary(db);
    expect(byUser).toEqual([
      { userId: 'u2', username: 'bob', requests: 1, tokens: 200, promptTokens: 100, completionTokens: 100, errors: 0 },
      { userId: 'u1', username: 'alice', requests: 3, tokens: 50, promptTokens: 15, completionTokens: 35, errors: 1 },
    ]);
  });

  it('aggregates per model (error row contributes a request but 0 tokens)', () => {
    const { byModel } = computeUsageSummary(db);
    expect(byModel).toEqual([
      { modelNormalized: 'gpt', requests: 3, tokens: 250, promptTokens: 115, completionTokens: 135 },
      { modelNormalized: 'claude', requests: 1, tokens: 0, promptTokens: 0, completionTokens: 0 },
    ]);
  });

  it('computes totals (tokens=ok only, distinct users, error count)', () => {
    expect(computeUsageSummary(db).totals).toEqual({ requests: 4, tokens: 250, errors: 1, users: 2 });
  });

  it('honours the from/to date filter', () => {
    const { totals } = computeUsageSummary(db, { from: '2026-07-02' }); // excludes row 1
    expect(totals).toEqual({ requests: 3, tokens: 220, errors: 1, users: 2 });
  });

  it('honours the kind filter', () => {
    const { totals } = computeUsageSummary(db, { kind: 'image' }); // none match
    expect(totals).toEqual({ requests: 0, tokens: 0, errors: 0, users: 0 });
  });
});
