import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { computeUsageSummary, computeCost, loadPricingMap } from './usage';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';

// $ cost dashboard (v0.7.54): per-model unit prices (per 1M tokens, currency-
// agnostic) → cost columns on the admin usage summary. Unpriced models are
// NEVER guessed: their cost stays null and dependent aggregates get flagged.

function seed(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS); // real schema incl. migration v9 model_pricing
  // api_usage_logs.user_id has an FK → users(id); create the two members first.
  const insUser = db.prepare(`INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, 'x', 'user')`);
  insUser.run('u1', 'alice');
  insUser.run('u2', 'bob');
  const ins = db.prepare(`INSERT INTO api_usage_logs
    (id, user_id, username, kind, model_normalized, status, prompt_tokens, completion_tokens, total_tokens, created_at)
    VALUES (?, ?, ?, 'chat', ?, ?, ?, ?, ?, ?)`);
  // alice: 1M prompt + 2M completion on gpt; 1M/1M on mystery (unpriced)
  ins.run('1', 'u1', 'alice', 'gpt', 'ok', 1_000_000, 2_000_000, 3_000_000, '2026-07-01');
  ins.run('2', 'u1', 'alice', 'mystery', 'ok', 1_000_000, 1_000_000, 2_000_000, '2026-07-02');
  // bob: 500k/500k on gpt
  ins.run('3', 'u2', 'bob', 'gpt', 'ok', 500_000, 500_000, 1_000_000, '2026-07-03');
  return db;
}

function price(db: Database.Database, model: string, pp: number, cp: number): void {
  db.prepare(`INSERT INTO model_pricing (model_normalized, prompt_price_per_m, completion_price_per_m)
              VALUES (?, ?, ?)`).run(model, pp, cp);
}

describe('computeCost (pure)', () => {
  it('prompt and completion sides use their own per-1M rates', () => {
    expect(computeCost(1_000_000, 2_000_000, { promptPricePerM: 2, completionPricePerM: 8 })).toBe(2 + 16);
    expect(computeCost(0, 0, { promptPricePerM: 2, completionPricePerM: 8 })).toBe(0);
    expect(computeCost(500_000, 0, { promptPricePerM: 3, completionPricePerM: 99 })).toBe(1.5);
  });
});

describe('loadPricingMap', () => {
  it('both-zero rows count as not priced', () => {
    const db = seed();
    price(db, 'gpt', 2, 8);
    price(db, 'freebie', 0, 0);
    const map = loadPricingMap(db);
    expect(map.has('gpt')).toBe(true);
    expect(map.has('freebie')).toBe(false);
    db.close();
  });
});

describe('computeUsageSummary with pricing', () => {
  let db: Database.Database;
  beforeEach(() => { db = seed(); });

  it('per-model cost for priced models; null for unpriced', () => {
    price(db, 'gpt', 2, 8); // gpt total: 1.5M prompt * 2 + 2.5M completion * 8 = 3 + 20 = 23
    const { byModel } = computeUsageSummary(db);
    const gpt = byModel.find((m) => m.modelNormalized === 'gpt');
    const mystery = byModel.find((m) => m.modelNormalized === 'mystery');
    expect(gpt?.cost).toBeCloseTo(23);
    expect(mystery?.cost).toBeNull();
    db.close();
  });

  it('per-user cost sums the user\'s priced models and flags incomplete when unpriced models were also used', () => {
    price(db, 'gpt', 2, 8);
    const { byUser } = computeUsageSummary(db);
    const alice = byUser.find((u) => u.username === 'alice');
    const bob = byUser.find((u) => u.username === 'bob');
    expect(alice?.cost).toBeCloseTo(1 * 2 + 2 * 8); // 18 — gpt part only
    expect(alice?.costIncomplete).toBe(true); // mystery is unpriced
    expect(bob?.cost).toBeCloseTo(0.5 * 2 + 0.5 * 8); // 5
    expect(bob?.costIncomplete).toBe(false);
    db.close();
  });

  it('totals.cost sums priced models and flags incomplete; no pricing at all → null', () => {
    const before = computeUsageSummary(db);
    expect(before.totals.cost).toBeNull();
    expect(before.totals.costIncomplete).toBe(false);

    price(db, 'gpt', 2, 8);
    const after = computeUsageSummary(db);
    expect(after.totals.cost).toBeCloseTo(23);
    expect(after.totals.costIncomplete).toBe(true); // mystery still unpriced

    price(db, 'mystery', 1, 1);
    const full = computeUsageSummary(db);
    expect(full.totals.cost).toBeCloseTo(23 + 2);
    expect(full.totals.costIncomplete).toBe(false);
    db.close();
  });

  it('pricing upsert round-trip (ON CONFLICT updates in place)', () => {
    price(db, 'gpt', 2, 8);
    db.prepare(`INSERT INTO model_pricing (model_normalized, prompt_price_per_m, completion_price_per_m)
                VALUES ('gpt', 4, 16)
                ON CONFLICT(model_normalized) DO UPDATE SET
                  prompt_price_per_m = excluded.prompt_price_per_m,
                  completion_price_per_m = excluded.completion_price_per_m`).run();
    const map = loadPricingMap(db);
    expect(map.get('gpt')).toEqual({ modelNormalized: 'gpt', promptPricePerM: 4, completionPricePerM: 16 });
    db.close();
  });
});
