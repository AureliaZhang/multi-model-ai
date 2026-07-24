import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { canSeeFile, filterVisibleFileIds } from './files';

type User = { id: string; role: string };
const alice: User = { id: 'alice', role: 'user' };
const bob: User = { id: 'bob', role: 'user' };
const admin: User = { id: 'root', role: 'admin' };

describe('canSeeFile (default-private file visibility)', () => {
  it('uploader sees their own private file', () => {
    expect(canSeeFile(alice, { uploaded_by: 'alice', visibility: 'private' })).toBe(true);
  });

  it('a different member cannot see someone else’s private file', () => {
    expect(canSeeFile(bob, { uploaded_by: 'alice', visibility: 'private' })).toBe(false);
  });

  it('anyone sees a team-shared file', () => {
    expect(canSeeFile(bob, { uploaded_by: 'alice', visibility: 'team' })).toBe(true);
  });

  it('admin sees any file (even others’ private)', () => {
    expect(canSeeFile(admin, { uploaded_by: 'alice', visibility: 'private' })).toBe(true);
  });

  it('legacy ownerless file is treated as shared', () => {
    expect(canSeeFile(bob, { uploaded_by: null, visibility: 'private' })).toBe(true);
  });

  it('unauthenticated caller sees nothing', () => {
    expect(canSeeFile(undefined, { uploaded_by: 'alice', visibility: 'team' })).toBe(false);
  });
});

describe('filterVisibleFileIds (RAG isolation gate)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db, SCHEMA_MIGRATIONS);
    // Two users; the migration adds `visibility`, defaulting new rows to 'private'.
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('alice','alice','h','user')").run();
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('bob','bob','h','user')").run();
    const ins = db.prepare(
      `INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status, uploaded_by, visibility)
       VALUES (?, ?, ?, 'text/plain', 1, 'ready', ?, ?)`
    );
    ins.run('f-alice-priv', 'a.txt', 'a', 'alice', 'private');
    ins.run('f-alice-team', 't.txt', 't', 'alice', 'team');
    ins.run('f-bob-priv', 'b.txt', 'b', 'bob', 'private');
  });

  it('drops another member’s private file id even when explicitly passed', () => {
    const ids = filterVisibleFileIds(db, ['f-alice-priv', 'f-alice-team', 'f-bob-priv'], bob);
    expect(ids.sort()).toEqual(['f-alice-team', 'f-bob-priv'].sort());
  });

  it('keeps the uploader’s own private + any team file', () => {
    const ids = filterVisibleFileIds(db, ['f-alice-priv', 'f-alice-team', 'f-bob-priv'], alice);
    expect(ids.sort()).toEqual(['f-alice-priv', 'f-alice-team'].sort());
  });

  it('admin keeps everything', () => {
    const ids = filterVisibleFileIds(db, ['f-alice-priv', 'f-alice-team', 'f-bob-priv'], admin);
    expect(ids.length).toBe(3);
  });

  it('empty input / no user → empty', () => {
    expect(filterVisibleFileIds(db, [], alice)).toEqual([]);
    expect(filterVisibleFileIds(db, ['f-alice-priv'], undefined)).toEqual([]);
  });

  it('unknown ids are silently dropped (not fabricated)', () => {
    expect(filterVisibleFileIds(db, ['does-not-exist'], admin)).toEqual([]);
  });
});
