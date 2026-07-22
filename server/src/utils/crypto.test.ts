import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { encryptSecret, decryptSecret, isEncrypted, encryptionEnabled } from './crypto';

const KEY = 'test-encryption-key-please-be-long-and-random';
const orig = process.env.ENCRYPTION_KEY;

function withKey(k: string | undefined) {
  if (k === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = k;
}

afterEach(() => { withKey(orig); });

describe('crypto — key configured', () => {
  it('round-trips a secret and emits a self-describing envelope', () => {
    withKey(KEY);
    const plain = 'sk-super-secret-api-key-1234567890';
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('uses a random IV — encrypting the same value twice differs, both decrypt', () => {
    withKey(KEY);
    const a = encryptSecret('same');
    const b = encryptSecret('same');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same');
    expect(decryptSecret(b)).toBe('same');
  });

  it('is idempotent — never double-encrypts an already-encrypted value', () => {
    withKey(KEY);
    const enc = encryptSecret('x');
    expect(encryptSecret(enc)).toBe(enc);
  });

  it('rejects tampered ciphertext (GCM auth failure)', () => {
    withKey(KEY);
    const enc = encryptSecret('secret');
    // Flip a character in the ciphertext segment.
    const tampered = enc.slice(0, -3) + (enc.slice(-3) === 'AAA' ? 'BBB' : 'AAA');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('encryptionEnabled reflects the env', () => {
    withKey(KEY);
    expect(encryptionEnabled()).toBe(true);
    withKey(undefined);
    expect(encryptionEnabled()).toBe(false);
  });

  it('a value encrypted under a different key does not decrypt', () => {
    withKey(KEY);
    const enc = encryptSecret('secret');
    withKey('a-totally-different-key');
    expect(() => decryptSecret(enc)).toThrow();
  });
});

describe('crypto — no key (opt-in / backward compatible)', () => {
  it('encryptSecret is a passthrough (stores plaintext, today’s behaviour)', () => {
    withKey(undefined);
    expect(encryptSecret('plain')).toBe('plain');
    expect(isEncrypted('plain')).toBe(false);
    expect(encryptionEnabled()).toBe(false);
  });

  it('decryptSecret passes legacy plaintext through unchanged', () => {
    withKey(undefined);
    expect(decryptSecret('sk-legacy-plaintext')).toBe('sk-legacy-plaintext');
  });

  it('throws (loud) if an encrypted value is found but no key is set', () => {
    withKey(KEY);
    const enc = encryptSecret('secret');
    withKey(undefined);
    expect(() => decryptSecret(enc)).toThrow(/ENCRYPTION_KEY is not set/);
  });
});

describe('crypto — at-rest storage integration', () => {
  it('stores ciphertext in the DB column, reads back the original', () => {
    withKey(KEY);
    const db = new Database(':memory:');
    db.exec('CREATE TABLE stations (id TEXT PRIMARY KEY, api_key TEXT NOT NULL)');
    db.prepare('INSERT INTO stations (id, api_key) VALUES (?, ?)').run('s1', encryptSecret('sk-live-xyz'));

    // Raw column is ciphertext (not the plaintext key).
    const raw = db.prepare('SELECT api_key FROM stations WHERE id = ?').get('s1') as { api_key: string };
    expect(raw.api_key).not.toContain('sk-live-xyz');
    expect(isEncrypted(raw.api_key)).toBe(true);

    // Application read path decrypts back to the usable key.
    expect(decryptSecret(raw.api_key)).toBe('sk-live-xyz');
    db.close();
  });
});
