import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';

/**
 * Locks the schema + semantics contract that the chat handler's per-attachment
 * extraction cache relies on (v0.7.45 perf work). The handler stores the result
 * of extractFileText() into attachments.extracted_text so a historical PDF/text
 * file is parsed at most once, then read straight from the column on later turns.
 *
 * Contract:
 *   - extracted_text = NULL  → never parsed yet (parse on demand, then persist).
 *   - extracted_text = ''    → parsed, but the file had no usable text; must NOT
 *                              be re-parsed (reads back as "no text" via `|| null`).
 *   - extracted_text = '...' → cache hit; used verbatim, no re-parse.
 */
describe('attachment extraction cache (v5 column contract)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db, SCHEMA_MIGRATIONS);
    // Minimal parent rows to satisfy FK chain (conversation → message → attachment).
    db.prepare(
      "INSERT INTO conversations (id, title, model_normalized_name) VALUES ('c1', 't', 'm')"
    ).run();
    db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content) VALUES ('m1', 'c1', 'user', 'hi')"
    ).run();
  });

  function insertAtt(id: string): void {
    db.prepare(
      `INSERT INTO attachments (id, message_id, type, filename, mime_type, url)
       VALUES (?, 'm1', 'file', 'doc.pdf', 'application/pdf', 'data:application/pdf;base64,AAAA')`
    ).run(id);
  }

  it('defaults extracted_text to NULL on insert (not yet parsed)', () => {
    insertAtt('a1');
    const row = db.prepare('SELECT extracted_text FROM attachments WHERE id = ?').get('a1') as {
      extracted_text: string | null;
    };
    expect(row.extracted_text).toBeNull();
  });

  it('persists a non-empty extraction and reads it back verbatim (cache hit)', () => {
    insertAtt('a2');
    db.prepare('UPDATE attachments SET extracted_text = ? WHERE id = ?').run('hello world', 'a2');
    const row = db.prepare('SELECT extracted_text FROM attachments WHERE id = ?').get('a2') as {
      extracted_text: string | null;
    };
    expect(row.extracted_text).toBe('hello world');
    // Handler reads `extracted_text !== null` → true, so no re-parse.
    expect(row.extracted_text !== null).toBe(true);
  });

  it("persists '' for a parsed-but-empty file so it is never re-parsed", () => {
    insertAtt('a3');
    // Handler writes `extracted ?? ''` — an unsupported/empty file stores ''.
    db.prepare('UPDATE attachments SET extracted_text = ? WHERE id = ?').run('', 'a3');
    const row = db.prepare('SELECT extracted_text FROM attachments WHERE id = ?').get('a3') as {
      extracted_text: string | null;
    };
    // Not NULL → cache is considered populated (no re-parse), but `|| null` = no text.
    expect(row.extracted_text).toBe('');
    expect(row.extracted_text !== null).toBe(true);
    expect(row.extracted_text || null).toBeNull();
  });

  it('groups a batched multi-message attachment query by message_id in insert order', () => {
    // Second message + attachments across both, to mirror the batched IN(...) load.
    db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content) VALUES ('m2', 'c1', 'user', 'yo')"
    ).run();
    insertAtt('b1');
    db.prepare(
      `INSERT INTO attachments (id, message_id, type, filename, mime_type, url)
       VALUES ('b2', 'm2', 'file', 'x.txt', 'text/plain', 'data:text/plain;base64,AAAA'),
              ('b3', 'm2', 'image', 'p.png', 'image/png', 'data:image/png;base64,AAAA')`
    ).run();

    const rows = db
      .prepare(
        `SELECT id, message_id FROM attachments WHERE message_id IN ('m1','m2')`
      )
      .all() as { id: string; message_id: string }[];

    const byMsg = new Map<string, string[]>();
    for (const r of rows) {
      const list = byMsg.get(r.message_id) || [];
      list.push(r.id);
      byMsg.set(r.message_id, list);
    }
    expect(byMsg.get('m1')).toEqual(['b1']);
    expect(byMsg.get('m2')).toEqual(['b2', 'b3']);
  });
});
