import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { SCHEMA_MIGRATIONS } from '../database';
import { canModifyPersona } from './personas';
import type { PersonaLibraryRow } from '../dbRows';
import type { AuthRequest } from '../types';

// Minimal AuthRequest stub — canModifyPersona only reads req.user.{id,role}.
function reqAs(user: { id: string; role: string } | undefined): AuthRequest {
  return { user } as unknown as AuthRequest;
}

function personaRow(overrides: Partial<PersonaLibraryRow> = {}): PersonaLibraryRow {
  return {
    id: 'p1',
    title: '文案',
    body: 'You are a copywriter.',
    description: null,
    created_by: 'alice',
    created_at: 't',
    updated_at: 't',
    ...overrides,
  };
}

describe('persona-library v3 migration', () => {
  it('creates persona_library with the expected columns', () => {
    const db = new Database(':memory:');
    runMigrations(db, SCHEMA_MIGRATIONS);
    const cols = (db.prepare(`PRAGMA table_info(persona_library)`).all() as { name: string }[])
      .map((c) => c.name)
      .sort();
    expect(cols).toEqual(
      ['body', 'created_at', 'created_by', 'description', 'id', 'title', 'updated_at'].sort()
    );
    // and it is recorded in the ledger
    const versions = (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[])
      .map((r) => r.version);
    expect(versions).toContain(3);
    db.close();
  });
});

describe('canModifyPersona', () => {
  let row: PersonaLibraryRow;
  beforeEach(() => { row = personaRow({ created_by: 'alice' }); });

  it('lets the creator modify', () => {
    expect(canModifyPersona(reqAs({ id: 'alice', role: 'user' }), row)).toBe(true);
  });

  it('lets an admin modify anyone’s persona', () => {
    expect(canModifyPersona(reqAs({ id: 'bob', role: 'admin' }), row)).toBe(true);
  });

  it('forbids a different non-admin member', () => {
    expect(canModifyPersona(reqAs({ id: 'bob', role: 'user' }), row)).toBe(false);
  });

  it('forbids an unauthenticated caller', () => {
    expect(canModifyPersona(reqAs(undefined), row)).toBe(false);
  });

  it('forbids modifying an ownerless (created_by NULL) persona unless admin', () => {
    const orphan = personaRow({ created_by: null });
    expect(canModifyPersona(reqAs({ id: 'alice', role: 'user' }), orphan)).toBe(false);
    expect(canModifyPersona(reqAs({ id: 'bob', role: 'admin' }), orphan)).toBe(true);
  });
});
