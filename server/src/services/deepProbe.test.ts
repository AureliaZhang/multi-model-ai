import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import {
  PROBE_QUESTIONS,
  pickDailyProbeTime,
  probeDay,
  dueForProbe,
  runDeepProbe,
} from './deepProbe';

// Daily deep probe (v0.7.79): random-time scheduling math + the probe flow
// against an in-memory DB with a stubbed fetch (no network).

const DAY_MS = 24 * 60 * 60 * 1000;

describe('pickDailyProbeTime / probeDay / dueForProbe', () => {
  it('probe time lands inside the day and follows the rng', () => {
    const dayStart = new Date(2026, 6, 26, 0, 0, 0, 0).getTime();
    expect(pickDailyProbeTime(dayStart, () => 0)).toBe(dayStart);
    expect(pickDailyProbeTime(dayStart, () => 0.999999)).toBeLessThan(dayStart + DAY_MS);
    const mid = pickDailyProbeTime(dayStart, () => 0.5);
    expect(mid).toBe(dayStart + DAY_MS / 2);
    expect(probeDay(mid)).toBe('2026-07-26');
  });

  it('due only when past the scheduled time AND not yet probed today', () => {
    const at = new Date(2026, 6, 26, 14, 30).getTime();
    const before = new Date(2026, 6, 26, 14, 0).getTime();
    const after = new Date(2026, 6, 26, 15, 0).getTime();
    expect(dueForProbe(null, at, before)).toBe(false); // not yet time
    expect(dueForProbe(null, at, after)).toBe(true); // never probed
    expect(dueForProbe(new Date(2026, 6, 26, 14, 31).toISOString(), at, after)).toBe(false); // already today
    expect(dueForProbe(new Date(2026, 6, 25, 23, 0).toISOString(), at, after)).toBe(true); // yesterday
  });

  it('the question pool contains no hello-pings', () => {
    for (const q of PROBE_QUESTIONS) {
      expect(q.length).toBeGreaterThan(8);
      expect(q.toLowerCase()).not.toContain('hello');
      expect(q).not.toContain('你好，');
    }
  });
});

function freshDb(withModel = true): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS);
  db.prepare(`INSERT INTO stations (id, name, base_url, api_key, enabled) VALUES ('s1', '丑猫', 'http://relay/v1', 'k', 1)`).run();
  if (withModel) {
    db.prepare(`INSERT INTO station_models (id, station_id, model_id, display_name, capabilities, enabled) VALUES ('sm1', 's1', 'minimax-m25', 'M', '["text"]', 1)`).run();
  }
  return db;
}

function stationRow(db: Database.Database) {
  return db.prepare('SELECT health_status, last_deep_probe FROM stations WHERE id = ?').get('s1') as {
    health_status: string;
    last_deep_probe: string | null;
  };
}

function stubFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return { ok: status < 400, status, json: async () => body };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const OK_COMPLETION = {
  choices: [{ message: { content: 'AI 是更大的概念，LLM 是其中基于大规模文本训练的一类模型……' } }],
  usage: { prompt_tokens: 20, completion_tokens: 80, total_tokens: 100 },
};

describe('runDeepProbe', () => {
  it('healthy path: real question posted to the station itself, health + watermark + usage log written', async () => {
    const db = freshDb();
    const { impl, calls } = stubFetch(OK_COMPLETION);
    const logged: Array<Record<string, unknown>> = [];
    const res = await runDeepProbe('s1', db, {
      fetchImpl: impl,
      log: ((e: Record<string, unknown>) => { logged.push(e); }) as never,
      rng: () => 0, // first model, first question
    });
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://relay/v1/chat/completions');
    expect(calls[0].body.model).toBe('minimax-m25');
    const sentMessages = calls[0].body.messages as Array<{ content: string }>;
    expect(sentMessages[0].content).toBe(PROBE_QUESTIONS[0]); // a real question, not a ping
    const row = stationRow(db);
    expect(row.health_status).toBe('healthy');
    expect(row.last_deep_probe).not.toBeNull();
    expect(logged).toHaveLength(1);
    expect(logged[0].status).toBe('ok');
    expect(logged[0].totalTokens).toBe(100);
    db.close();
  });

  it('upstream 503 / empty completion flip the station to unhealthy (and log the reason)', async () => {
    const db = freshDb();
    const logged: Array<Record<string, unknown>> = [];
    const log = ((e: Record<string, unknown>) => { logged.push(e); }) as never;
    const r1 = await runDeepProbe('s1', db, { fetchImpl: stubFetch({}, 503).impl, log, rng: () => 0 });
    expect(r1.ok).toBe(false);
    expect(stationRow(db).health_status).toBe('unhealthy');
    const r2 = await runDeepProbe('s1', db, {
      fetchImpl: stubFetch({ choices: [{ message: { content: '' } }] }).impl,
      log,
      rng: () => 0,
    });
    expect(r2).toEqual({ ok: false, reason: 'empty_completion' });
    expect(logged[0].errorMessage).toContain('deep-probe');
    db.close();
  });

  it('no enabled models: stamps the day (no all-day retry loop) without flipping health', async () => {
    const db = freshDb(false);
    const res = await runDeepProbe('s1', db, { fetchImpl: stubFetch(OK_COMPLETION).impl, log: (() => {}) as never });
    expect(res).toEqual({ ok: false, reason: 'no_enabled_models' });
    const row = stationRow(db);
    expect(row.last_deep_probe).not.toBeNull();
    expect(row.health_status).toBe('unknown'); // untouched default
    db.close();
  });

  it('disabled or unknown stations are refused', async () => {
    const db = freshDb();
    db.prepare('UPDATE stations SET enabled = 0 WHERE id = ?').run('s1');
    expect((await runDeepProbe('s1', db, { log: (() => {}) as never })).ok).toBe(false);
    expect((await runDeepProbe('nope', db, { log: (() => {}) as never })).ok).toBe(false);
    db.close();
  });
});
