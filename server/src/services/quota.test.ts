import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { monthStartISO, getUserMonthlyTokens, getUserMonthlyLimit, checkUserQuota } from './quota';

const NOW = new Date('2026-07-15T12:00:00.000Z');

function seed(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, monthly_token_limit INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE api_usage_logs (
      id TEXT PRIMARY KEY, user_id TEXT, status TEXT NOT NULL DEFAULT 'ok',
      total_tokens INTEGER, created_at TEXT
    );
  `);
  db.prepare('INSERT INTO users (id, monthly_token_limit) VALUES (?, ?)').run('u1', 200);
  db.prepare('INSERT INTO users (id, monthly_token_limit) VALUES (?, ?)').run('u2', 0); // unlimited
  const log = db.prepare('INSERT INTO api_usage_logs (id, user_id, status, total_tokens, created_at) VALUES (?, ?, ?, ?, ?)');
  log.run('1', 'u1', 'ok', 100, '2026-07-05T09:00:00.000Z'); // this month
  log.run('2', 'u1', 'ok', 50, '2026-07-10T09:00:00.000Z');  // this month
  log.run('3', 'u1', 'ok', 999, '2026-06-30T23:59:00.000Z'); // last month — excluded
  log.run('4', 'u1', 'error', 100, '2026-07-11T09:00:00.000Z'); // not ok — excluded
  log.run('5', 'u2', 'ok', 30, '2026-07-06T09:00:00.000Z'); // other user
  return db;
}

describe('quota', () => {
  let db: Database.Database;
  beforeEach(() => { db = seed(); });

  it('monthStartISO is the 1st of the UTC month', () => {
    expect(monthStartISO(NOW)).toBe('2026-07-01T00:00:00.000Z');
  });

  it('getUserMonthlyTokens sums only this-month successful rows for the user', () => {
    expect(getUserMonthlyTokens(db, 'u1', NOW)).toBe(150); // 100 + 50 (not 999 last-month, not error, not u2)
    expect(getUserMonthlyTokens(db, 'u2', NOW)).toBe(30);
    expect(getUserMonthlyTokens(db, 'nobody', NOW)).toBe(0);
  });

  it('getUserMonthlyLimit reads the column (0 when unset/unlimited)', () => {
    expect(getUserMonthlyLimit(db, 'u1')).toBe(200);
    expect(getUserMonthlyLimit(db, 'u2')).toBe(0);
    expect(getUserMonthlyLimit(db, 'nobody')).toBe(0);
  });

  it('unlimited (limit<=0) never exceeds and skips the usage query', () => {
    const q = checkUserQuota(db, 'u2', NOW);
    expect(q).toEqual({ limit: 0, used: 0, remaining: Infinity, exceeded: false });
  });

  it('under the cap: not exceeded, remaining computed', () => {
    // u1 used 150, limit 200
    expect(checkUserQuota(db, 'u1', NOW)).toEqual({ limit: 200, used: 150, remaining: 50, exceeded: false });
  });

  it('at or over the cap: exceeded, remaining floored at 0', () => {
    db.prepare('UPDATE users SET monthly_token_limit = ? WHERE id = ?').run(150, 'u1'); // exactly used
    expect(checkUserQuota(db, 'u1', NOW)).toEqual({ limit: 150, used: 150, remaining: 0, exceeded: true });

    db.prepare('UPDATE users SET monthly_token_limit = ? WHERE id = ?').run(100, 'u1'); // over
    expect(checkUserQuota(db, 'u1', NOW)).toEqual({ limit: 100, used: 150, remaining: 0, exceeded: true });
  });
});
