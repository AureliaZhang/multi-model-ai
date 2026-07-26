import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { limitHistory, getHistoryMaxTurns } from './chat';

// History LIMIT (§10.8 TC2 #2, owner decision 2026-07-26): send only the last
// N turns of verbatim history (default 20, admin-tunable, 0 = unlimited);
// older context is covered by the memory-store RAG injection.

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS); // incl. v8 memory_config.history_max_turns
  return db;
}

function msgs(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `m${i}`);
}

describe('limitHistory (pure)', () => {
  it('0 or negative or garbage maxTurns = unlimited (identity)', () => {
    const rows = msgs(50);
    expect(limitHistory(rows, 0)).toBe(rows);
    expect(limitHistory(rows, -3)).toBe(rows);
    expect(limitHistory(rows, NaN)).toBe(rows);
  });

  it('keeps the LAST maxTurns*2 messages when over the window', () => {
    const rows = msgs(50);
    const out = limitHistory(rows, 20);
    expect(out).toHaveLength(40);
    expect(out[0]).toBe('m10'); // oldest 10 dropped
    expect(out[out.length - 1]).toBe('m49'); // newest (current user msg) kept
  });

  it('shorter-than-window histories pass through untouched', () => {
    const rows = msgs(7);
    expect(limitHistory(rows, 20)).toBe(rows);
    expect(limitHistory(msgs(40), 20)).toHaveLength(40); // exactly at window
  });

  it('odd message counts still keep the newest tail', () => {
    const out = limitHistory(msgs(9), 2); // window = 4 messages
    expect(out).toEqual(['m5', 'm6', 'm7', 'm8']);
  });

  it('fractional turns floor to whole turns', () => {
    expect(limitHistory(msgs(10), 2.9)).toHaveLength(4);
  });
});

describe('getHistoryMaxTurns (migration v8 + config)', () => {
  it('fresh DB defaults to 20', () => {
    const db = freshDb();
    expect(getHistoryMaxTurns(db)).toBe(20);
    db.close();
  });

  it('reads an admin-updated value live; 0 = unlimited round-trips', () => {
    const db = freshDb();
    db.prepare('UPDATE memory_config SET history_max_turns = 50 WHERE id = 1').run();
    expect(getHistoryMaxTurns(db)).toBe(50);
    db.prepare('UPDATE memory_config SET history_max_turns = 0 WHERE id = 1').run();
    expect(getHistoryMaxTurns(db)).toBe(0);
    db.close();
  });

  it('negative garbage in the column falls back to the default', () => {
    const db = freshDb();
    db.prepare('UPDATE memory_config SET history_max_turns = -5 WHERE id = 1').run();
    expect(getHistoryMaxTurns(db)).toBe(20);
    db.close();
  });
});
