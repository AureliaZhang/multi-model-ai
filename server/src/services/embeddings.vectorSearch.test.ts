import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { vectorSearch, serializeEmbedding } from './embeddings';

function openMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE memory_entries (
      id TEXT PRIMARY KEY,
      summary TEXT,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      role TEXT NOT NULL,
      importance REAL NOT NULL DEFAULT 0.5,
      embedding TEXT
    );
  `);
  return db;
}

function insert(
  db: Database.Database,
  id: string,
  embedding: number[],
  opts: { summary?: string; importance?: number; content?: string } = {}
): void {
  db.prepare(`
    INSERT INTO memory_entries (id, summary, content, keywords, created_at, role, importance, embedding)
    VALUES (?, ?, ?, '[]', datetime('now'), 'user', ?, ?)
  `).run(
    id,
    opts.summary ?? `sum-${id}`,
    opts.content ?? `content-${id}`,
    opts.importance ?? 0.5,
    serializeEmbedding(embedding)
  );
}

describe('vectorSearch (SQLite harness)', () => {
  it('returns empty when no embeddings exist', () => {
    const db = openMemoryDb();
    expect(vectorSearch(db, [1, 0, 0], 5, 0.1)).toEqual([]);
    db.close();
  });

  it('ranks closer vectors higher and respects limit', () => {
    const db = openMemoryDb();
    insert(db, 'near', [1, 0, 0], { summary: 'near' });
    insert(db, 'mid', [0.7, 0.7, 0], { summary: 'mid' });
    insert(db, 'far', [0, 1, 0], { summary: 'far' });

    const hits = vectorSearch(db, [1, 0, 0], 2, 0.0);
    expect(hits).toHaveLength(2);
    expect(hits[0].summary).toBe('near');
    db.close();
  });

  it('filters below threshold', () => {
    const db = openMemoryDb();
    insert(db, 'ortho', [0, 1, 0]);
    // cosine([1,0,0],[0,1,0]) = 0 → below 0.5
    expect(vectorSearch(db, [1, 0, 0], 5, 0.5)).toEqual([]);
    db.close();
  });

  it('skips invalid embedding JSON', () => {
    const db = openMemoryDb();
    db.prepare(`
      INSERT INTO memory_entries (id, summary, content, keywords, created_at, role, importance, embedding)
      VALUES ('bad', 'b', 'c', '[]', datetime('now'), 'user', 0.5, 'not-json')
    `).run();
    insert(db, 'good', [1, 0], { summary: 'good' });
    const hits = vectorSearch(db, [1, 0], 5, 0.1);
    expect(hits).toHaveLength(1);
    expect(hits[0].summary).toBe('good');
    db.close();
  });

  it('breaks near-ties by higher importance', () => {
    const db = openMemoryDb();
    // Both very close to query — importance should decide when sim within 0.05
    insert(db, 'low', [0.99, 0.01], { importance: 0.1, summary: 'low' });
    insert(db, 'high', [0.98, 0.02], { importance: 0.9, summary: 'high' });
    const hits = vectorSearch(db, [1, 0], 2, 0.0);
    expect(hits[0].summary).toBe('high');
    db.close();
  });
});
