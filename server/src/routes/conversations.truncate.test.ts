import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { truncateMessagesFrom } from './conversations';

function seed(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
      content TEXT NOT NULL, created_at TEXT
    );
  `);
  const ins = db.prepare('INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)');
  // Insertion order = rowid order (what truncation relies on).
  ins.run('m1', 'c1', 'user', 'hi', 't');
  ins.run('m2', 'c1', 'assistant', 'hello', 't');
  ins.run('m3', 'c1', 'user', 'more', 't');
  ins.run('m4', 'c1', 'assistant', 'sure', 't');
  ins.run('m5', 'c1', 'user', 'again', 't');
  ins.run('x1', 'c2', 'user', 'other conv', 't'); // different conversation
  return db;
}

const idsIn = (db: Database.Database, conv: string) =>
  db.prepare('SELECT id FROM messages WHERE conversation_id = ? ORDER BY rowid').all(conv).map((r) => (r as { id: string }).id);

describe('truncateMessagesFrom', () => {
  let db: Database.Database;
  beforeEach(() => { db = seed(); });

  it('deletes the target and every message after it (by insert order)', () => {
    const res = truncateMessagesFrom(db, 'c1', 'm3');
    expect(res).toEqual({ found: true, deleted: 3 }); // m3, m4, m5
    expect(idsIn(db, 'c1')).toEqual(['m1', 'm2']);
  });

  it('does not touch other conversations', () => {
    truncateMessagesFrom(db, 'c1', 'm1'); // wipes all of c1
    expect(idsIn(db, 'c1')).toEqual([]);
    expect(idsIn(db, 'c2')).toEqual(['x1']);
  });

  it('is scoped to the conversation: a message id from another conv is "not found"', () => {
    const res = truncateMessagesFrom(db, 'c1', 'x1'); // x1 belongs to c2
    expect(res).toEqual({ found: false, deleted: 0 });
    expect(idsIn(db, 'c1')).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']); // unchanged
  });

  it('returns found:false for an unknown message and deletes nothing', () => {
    const res = truncateMessagesFrom(db, 'c1', 'nope');
    expect(res).toEqual({ found: false, deleted: 0 });
    expect(idsIn(db, 'c1')).toHaveLength(5);
  });

  it('truncating from the last message removes only it', () => {
    const res = truncateMessagesFrom(db, 'c1', 'm5');
    expect(res).toEqual({ found: true, deleted: 1 });
    expect(idsIn(db, 'c1')).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});
