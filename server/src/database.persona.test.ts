import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { initTables } from './database';

// Exercises the REAL migration in database.ts (conversations is CREATEd without
// system_prompt, then ALTER ADD COLUMN system_prompt) against an in-memory DB,
// covering the per-conversation persona column and its insert / clear paths.
// initTables is pure DDL, so no seeding (and no CJS require path) runs here.

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initTables(db);
  return db;
}

describe('conversations.system_prompt (persona) migration + round-trip', () => {
  it('adds the system_prompt column via migration', () => {
    const db = freshDb();
    const cols = (db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('system_prompt');
    db.close();
  });

  it('round-trips a persona then clears it to null', () => {
    const db = freshDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO conversations (id, title, model_normalized_name, visibility, self_review, system_prompt, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, 'T', 'gpt-x', 'private', 0, 'You are my English tutor.', null, now, now);

    const row = db.prepare('SELECT system_prompt FROM conversations WHERE id = ?').get(id) as { system_prompt: string | null };
    expect(row.system_prompt).toBe('You are my English tutor.');

    db.prepare('UPDATE conversations SET system_prompt = ? WHERE id = ?').run(null, id);
    const row2 = db.prepare('SELECT system_prompt FROM conversations WHERE id = ?').get(id) as { system_prompt: string | null };
    expect(row2.system_prompt).toBeNull();
    db.close();
  });

  it('defaults to null when a legacy insert omits the column', () => {
    const db = freshDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    // Older column set (pre-persona) — the migrated column must default to NULL.
    db.prepare(
      'INSERT INTO conversations (id, title, model_normalized_name, visibility, self_review, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, 'T2', 'gpt-x', 'public', 0, null, now, now);

    const row = db.prepare('SELECT system_prompt FROM conversations WHERE id = ?').get(id) as { system_prompt: string | null };
    expect(row.system_prompt).toBeNull();
    db.close();
  });
});
