import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { vectorSearch, serializeEmbedding, parseVectorScanLimit } from './embeddings';

// TC2 #3 (v0.7.52): the vector search used to full-scan + JSON.parse EVERY
// embedded memory row on every query. It now scans only the most-recent
// `scanLimit` embedded entries (default 2000, env VECTOR_SCAN_LIMIT, 0 = old
// unlimited behaviour).

function openMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE memory_entries (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      message_id TEXT,
      summary TEXT,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      role TEXT NOT NULL,
      importance REAL NOT NULL DEFAULT 0.5,
      embedding TEXT,
      user_id TEXT
    );
  `);
  return db;
}

function insertAt(db: Database.Database, id: string, embedding: number[], createdAt: string, userId: string | null = null): void {
  db.prepare(`
    INSERT INTO memory_entries (id, conversation_id, message_id, summary, content, keywords, created_at, role, importance, embedding, user_id)
    VALUES (?, ?, ?, ?, ?, '[]', ?, 'user', 0.5, ?, ?)
  `).run(id, `conv-${id}`, `msg-${id}`, `sum-${id}`, `content-${id}`, createdAt, serializeEmbedding(embedding), userId);
}

const QUERY = [1, 0, 0];
const MATCH = [1, 0, 0]; // similarity 1.0
const MISS = [0, 1, 0]; // similarity 0.0

describe('parseVectorScanLimit', () => {
  it('defaults to 2000; explicit values respected; 0 = unlimited; garbage falls back', () => {
    expect(parseVectorScanLimit({})).toBe(2000);
    expect(parseVectorScanLimit({ VECTOR_SCAN_LIMIT: '500' })).toBe(500);
    expect(parseVectorScanLimit({ VECTOR_SCAN_LIMIT: '0' })).toBe(0);
    expect(parseVectorScanLimit({ VECTOR_SCAN_LIMIT: '-9' })).toBe(2000);
    expect(parseVectorScanLimit({ VECTOR_SCAN_LIMIT: 'many' })).toBe(2000);
  });
});

describe('vectorSearch scan bound', () => {
  it('only the most-recent scanLimit rows are considered — an older perfect match outside the window is not returned', () => {
    const db = openMemoryDb();
    insertAt(db, 'old-match', MATCH, '2026-01-01 00:00:00'); // perfect match, but oldest
    insertAt(db, 'mid-miss', MISS, '2026-06-01 00:00:00');
    insertAt(db, 'new-miss', MISS, '2026-07-01 00:00:00');

    const bounded = vectorSearch(db, QUERY, 5, 0.3, undefined, 2);
    expect(bounded.map((r) => r.id)).toEqual([]); // window = 2 newest, both misses

    const unbounded = vectorSearch(db, QUERY, 5, 0.3, undefined, 0);
    expect(unbounded.map((r) => r.id)).toEqual(['old-match']); // 0 = old full-scan behaviour
    db.close();
  });

  it('matches inside the window still rank by similarity', () => {
    const db = openMemoryDb();
    insertAt(db, 'ancient-match', MATCH, '2025-01-01 00:00:00');
    insertAt(db, 'recent-partial', [0.9, 0.1, 0], '2026-07-01 00:00:00');
    insertAt(db, 'recent-match', MATCH, '2026-07-02 00:00:00');

    const res = vectorSearch(db, QUERY, 5, 0.3, undefined, 2);
    expect(res.map((r) => r.id)).toEqual(['recent-match', 'recent-partial']);
    db.close();
  });

  it('user scoping composes with the bound (scoped rows fill the window)', () => {
    const db = openMemoryDb();
    insertAt(db, 'alice-old', MATCH, '2026-01-01 00:00:00', 'alice');
    insertAt(db, 'bob-new-1', MATCH, '2026-07-01 00:00:00', 'bob');
    insertAt(db, 'bob-new-2', MATCH, '2026-07-02 00:00:00', 'bob');

    // Window of 2 over ALICE's scope: bob's newer rows must not evict alice's.
    const res = vectorSearch(db, QUERY, 5, 0.3, 'alice', 2);
    expect(res.map((r) => r.id)).toEqual(['alice-old']);
    db.close();
  });

  it('scan window larger than the table behaves like a full scan', () => {
    const db = openMemoryDb();
    insertAt(db, 'a', MATCH, '2026-01-01 00:00:00');
    insertAt(db, 'b', MATCH, '2026-02-01 00:00:00');
    const res = vectorSearch(db, QUERY, 5, 0.3, undefined, 9999);
    expect(res).toHaveLength(2);
    db.close();
  });
});
