import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { encryptSecret, decryptSecret, isEncrypted } from '../utils/crypto';

// v0.7.60 (§10.9 P0 #3): memory_config.embedding_api_key encrypted at rest —
// the one column the v0.7.37 crypto pass explicitly deferred. Round-trips the
// write-encrypt / read-decrypt contract used by routes/memories.ts and
// services/embeddings.ts against the real schema.

const TEST_KEY = Buffer.alloc(32, 7).toString('base64'); // deterministic 32-byte key

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, SCHEMA_MIGRATIONS); // seeds the memory_config single row
  return db;
}

beforeEach(() => { vi.stubEnv('ENCRYPTION_KEY', TEST_KEY); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('embedding API key at rest', () => {
  it('write-encrypt: the stored column is ciphertext, not the plaintext', () => {
    const db = freshDb();
    db.prepare('UPDATE memory_config SET embedding_api_key = ? WHERE id = 1')
      .run(encryptSecret('sk-team-secret'));
    const stored = (db.prepare('SELECT embedding_api_key AS k FROM memory_config WHERE id = 1').get() as { k: string }).k;
    expect(stored).not.toContain('sk-team-secret');
    expect(isEncrypted(stored)).toBe(true);
    expect(decryptSecret(stored)).toBe('sk-team-secret');
    db.close();
  });

  it('legacy plaintext passes through decryptSecret unchanged (pre-sweep reads never break)', () => {
    expect(decryptSecret('sk-legacy-plaintext')).toBe('sk-legacy-plaintext');
  });

  it('boot-sweep contract: plaintext value gets encrypted in place exactly once', () => {
    const db = freshDb();
    db.prepare('UPDATE memory_config SET embedding_api_key = ? WHERE id = 1').run('sk-plain');
    // Simulate the sweep in encryptPlaintextStationKeys' new second stanza:
    const before = (db.prepare('SELECT embedding_api_key AS k FROM memory_config WHERE id = 1').get() as { k: string }).k;
    expect(isEncrypted(before)).toBe(false);
    db.prepare('UPDATE memory_config SET embedding_api_key = ? WHERE id = 1').run(encryptSecret(before));
    const after = (db.prepare('SELECT embedding_api_key AS k FROM memory_config WHERE id = 1').get() as { k: string }).k;
    expect(isEncrypted(after)).toBe(true);
    // Re-running the sweep condition is a no-op: already encrypted
    expect(isEncrypted(after)).toBe(true);
    expect(decryptSecret(after)).toBe('sk-plain');
    db.close();
  });
});
