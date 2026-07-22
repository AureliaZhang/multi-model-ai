/**
 * Symmetric encryption for secrets at rest (§10.8 TC1 #3 — Phase 3).
 *
 * Station API keys (and any similar secret) are stored in SQLite. On a shared
 * team instance, plaintext keys mean anyone with DB/file access — or a stray
 * backup — walks away with every upstream credential. This wraps AES-256-GCM
 * (authenticated encryption) behind a tiny, backward-compatible API:
 *
 *   - `encryptSecret(plain)` → self-describing `enc:v1:<iv>:<tag>:<ct>` string.
 *   - `decryptSecret(stored)` → plaintext.
 *
 * Backward compatibility, so nothing breaks and adoption is opt-in:
 *   - No `ENCRYPTION_KEY` env  → `encryptSecret` is a PASSTHROUGH (stores
 *     plaintext, exactly today's behaviour); local/dev keeps working untouched.
 *   - Legacy plaintext values  → `decryptSecret` returns them as-is (detected by
 *     the absence of the `enc:v1:` prefix), so reads work before/without a sweep.
 *   - Set `ENCRYPTION_KEY`      → new writes are encrypted, reads decrypt, and a
 *     boot sweep (see database.ts) upgrades existing plaintext rows in place.
 *
 * Fail-loud only on real misconfiguration: an encrypted value present with NO
 * key set throws (you removed/rotated the key and would otherwise get garbage).
 *
 * `ENCRYPTION_KEY` should be a long, random string; it is hashed to a 32-byte
 * key. Losing it means the encrypted secrets are unrecoverable — keep it with
 * the same care as `JWT_SECRET`.
 */

import crypto from 'crypto';

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length

/** Derive the 32-byte AES key from the env secret, or null if unset. */
function getKey(): Buffer | null {
  const secret = process.env.ENCRYPTION_KEY?.trim();
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/** True when an ENCRYPTION_KEY is configured (encryption is active). */
export function encryptionEnabled(): boolean {
  return getKey() !== null;
}

/** True when `value` is one of our encrypted envelopes (vs legacy plaintext). */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypt a secret. No key configured → returns the plaintext unchanged
 * (opt-in). Already-encrypted input is returned unchanged (idempotent).
 */
export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key) return plain;              // opt-in: no key → store plaintext (today's behaviour)
  if (isEncrypted(plain)) return plain; // idempotent: never double-encrypt

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/**
 * Decrypt a stored secret. Legacy plaintext (no `enc:v1:` prefix) passes
 * through unchanged. Throws on tampering (GCM auth failure) or if an encrypted
 * value is found with no key configured.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext

  const key = getKey();
  if (!key) {
    throw new Error(
      '[crypto] Found an encrypted secret but ENCRYPTION_KEY is not set. ' +
      'Set ENCRYPTION_KEY to the value used to encrypt it.'
    );
  }

  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('[crypto] Malformed encrypted secret');
  const [ivB64, tagB64, ctB64] = parts;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}
