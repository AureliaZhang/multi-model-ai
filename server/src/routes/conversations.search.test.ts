import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { searchConversations } from './conversations';

function seed(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY, user_id TEXT, title TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'public', updated_at TEXT
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, content TEXT NOT NULL DEFAULT ''
    );
  `);
  const c = db.prepare('INSERT INTO conversations (id, user_id, title, visibility, updated_at) VALUES (?, ?, ?, ?, ?)');
  c.run('A', 'u1', 'Recipe ideas', 'private', '2026-07-01');
  c.run('B', 'u1', 'Work notes', 'private', '2026-07-02');       // message mentions banana
  c.run('C', 'u2', 'Private stuff', 'private', '2026-07-03');    // other user's private
  c.run('D', 'u2', 'Public chat', 'public', '2026-07-04');       // public from other user
  c.run('E', null, 'Legacy 100% off', 'public', '2026-07-05');   // ownerless; literal % in title
  const m = db.prepare('INSERT INTO messages (id, conversation_id, content) VALUES (?, ?, ?)');
  m.run('m1', 'B', 'remember to buy a banana');
  m.run('m2', 'C', 'secret banana plan');                        // content match but not in u1 scope
  return db;
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe('searchConversations', () => {
  let db: Database.Database;
  beforeEach(() => { db = seed(); });

  it('matches by title', () => {
    expect(ids(searchConversations(db, 'u1', 'Recipe'))).toEqual(['A']);
  });

  it('matches by message content', () => {
    // u1 sees B (own, banana in message); NOT C (other user's private, even though it also mentions banana)
    expect(ids(searchConversations(db, 'u1', 'banana'))).toEqual(['B']);
  });

  it('respects scope: own + public + ownerless, never another user’s private', () => {
    // u1 searching a broad term across everything visible
    expect(ids(searchConversations(db, 'u1', 'a'))).toEqual(['A', 'B', 'D', 'E']); // not C
  });

  it('guest sees public matches only', () => {
    expect(ids(searchConversations(db, undefined, 'chat'))).toEqual(['D']);
    expect(ids(searchConversations(db, undefined, 'stuff'))).toEqual([]); // private, hidden
  });

  it('escapes LIKE wildcards (literal % is not a wildcard)', () => {
    expect(ids(searchConversations(db, 'u1', '100%'))).toEqual(['E']); // matches the literal "100%"
    expect(ids(searchConversations(db, 'u1', 'zzz%'))).toEqual([]);    // % stays literal → no match
  });

  it('orders by updated_at desc', () => {
    const rows = searchConversations(db, 'u1', 'a');
    const times = rows.map((r) => (r as unknown as { updated_at: string }).updated_at);
    expect(times).toEqual([...times].sort().reverse());
  });
});
