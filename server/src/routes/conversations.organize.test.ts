import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { computeConversationUpdate } from './conversations';
import type { ConversationRow } from '../dbRows';

// Chat organize (§10.8 Phase 5 FE-A): migration v6 pin + folder semantics.
// computeConversationUpdate is the pure core of PUT /api/conversations/:id.

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS); // full schema incl. migration v6 (pinned/folder)
  return db;
}

function insertConv(db: Database.Database, opts: { pinned?: number; folder?: string | null; updatedAt?: string } = {}): string {
  const id = randomUUID();
  const now = opts.updatedAt || new Date().toISOString();
  db.prepare(`
    INSERT INTO conversations (id, title, model_normalized_name, visibility, pinned, folder, created_at, updated_at)
    VALUES (?, 'T', 'test-model', 'public', ?, ?, ?, ?)
  `).run(id, opts.pinned ?? 0, opts.folder ?? null, now, now);
  return id;
}

function getRow(db: Database.Database, id: string): ConversationRow {
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow;
}

describe('conversations organize — migration v6 defaults', () => {
  it('new conversations start unpinned and folderless', () => {
    const db = freshDb();
    const row = getRow(db, insertConv(db));
    expect(row.pinned).toBe(0);
    expect(row.folder).toBeNull();
    db.close();
  });
});

describe('computeConversationUpdate — pin/folder semantics', () => {
  it('undefined keeps existing pin + folder; other fields untouched', () => {
    const db = freshDb();
    const row = getRow(db, insertConv(db, { pinned: 1, folder: '工作' }));
    const next = computeConversationUpdate(row, { title: 'renamed' });
    expect(next.pinned).toBe(1);
    expect(next.folder).toBe('工作');
    expect(next.title).toBe('renamed');
    expect(next.visibility).toBe('public');
    db.close();
  });

  it('pin and unpin coerce to 1/0', () => {
    const db = freshDb();
    const row = getRow(db, insertConv(db));
    expect(computeConversationUpdate(row, { pinned: true }).pinned).toBe(1);
    const pinnedRow = { ...row, pinned: 1 };
    expect(computeConversationUpdate(pinnedRow, { pinned: false }).pinned).toBe(0);
    db.close();
  });

  it('folder set / trim / clear: string sets (trimmed), empty + null clear', () => {
    const db = freshDb();
    const row = getRow(db, insertConv(db));
    expect(computeConversationUpdate(row, { folder: '  项目A  ' }).folder).toBe('项目A');
    const inFolder = { ...row, folder: '项目A' };
    expect(computeConversationUpdate(inFolder, { folder: null }).folder).toBeNull();
    expect(computeConversationUpdate(inFolder, { folder: '   ' }).folder).toBeNull();
    expect(computeConversationUpdate(inFolder, { folder: 42 }).folder).toBeNull(); // non-string set → clear, never garbage
    db.close();
  });

  it('full UPDATE round-trip persists pin + folder', () => {
    const db = freshDb();
    const id = insertConv(db);
    const next = computeConversationUpdate(getRow(db, id), { pinned: true, folder: 'Research' });
    db.prepare('UPDATE conversations SET pinned = ?, folder = ? WHERE id = ?').run(next.pinned, next.folder, id);
    const row = getRow(db, id);
    expect(row.pinned).toBe(1);
    expect(row.folder).toBe('Research');
    db.close();
  });
});

describe('list ordering — pinned first, then most-recent', () => {
  it('ORDER BY pinned DESC, updated_at DESC floats pinned rows', () => {
    const db = freshDb();
    const oldPinned = insertConv(db, { pinned: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    const newUnpinned = insertConv(db, { pinned: 0, updatedAt: '2026-07-01T00:00:00.000Z' });
    const newPinned = insertConv(db, { pinned: 1, updatedAt: '2026-06-01T00:00:00.000Z' });
    const ids = (db.prepare(
      'SELECT id FROM conversations ORDER BY pinned DESC, updated_at DESC'
    ).all() as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual([newPinned, oldPinned, newUnpinned]);
    db.close();
  });
});
