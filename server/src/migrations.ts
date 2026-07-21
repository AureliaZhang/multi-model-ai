/**
 * Versioned schema migrations (§10.8 "Data safety" — Phase 2).
 *
 * Replaces the old stack of swallow-everything `try { ALTER TABLE } catch {}`
 * calls (see git history of `database.ts`) with a real, recorded migration
 * ledger:
 *
 *   - `schema_migrations` records every applied `(version, name, applied_at)`.
 *   - `runMigrations()` applies each pending migration IN ITS OWN TRANSACTION
 *     together with the ledger insert, so a crash or a throwing `up` leaves the
 *     DB at the last fully-applied version — never half-migrated.
 *   - A failing migration ABORTS the run loudly. We deliberately do NOT swallow
 *     errors the way the old ALTER stack did (a swallowed migration error on a
 *     shared team DB is exactly how you get silent divergence / data loss).
 *
 * The migration LIST lives in `database.ts` (`SCHEMA_MIGRATIONS`) so this module
 * stays a pure, dependency-free runner with no import back into `database.ts`
 * (avoids a require cycle; keeps the runner unit-testable with injected lists).
 */

import type Database from 'better-sqlite3';
import { getErrorMessage } from './utils/errors';

export interface Migration {
  /** Unique, strictly-positive, append-only. Never edit or reuse a shipped number. */
  version: number;
  /** Human label recorded in the ledger for audit. */
  name: string;
  /** Forward migration. Runs inside a transaction; throw to abort + roll back. */
  up: (db: Database.Database) => void;
}

export interface MigrationResult {
  /** Versions actually applied during this call, in order. */
  applied: number[];
  /** Versions skipped because already present in the ledger. */
  skipped: number[];
  /** Highest version recorded in the ledger after this call (0 = none). */
  currentVersion: number;
}

const MIGRATIONS_TABLE = 'schema_migrations';

/** Create the ledger table if it doesn't exist. Idempotent. */
export function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Set of migration versions already applied. */
export function getAppliedVersions(db: Database.Database): Set<number> {
  ensureMigrationsTable(db);
  const rows = db.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`).all() as { version: number }[];
  return new Set(rows.map((r) => r.version));
}

/**
 * Apply every not-yet-applied migration in ascending version order.
 *
 * Atomicity: each migration's `up` and its ledger INSERT share one transaction,
 * so the ledger can never claim a version whose DDL didn't fully land, and a
 * throwing migration rolls back cleanly and stops the run (subsequent
 * migrations are NOT attempted).
 *
 * @param migrations Full ordered set (order-independent input; sorted here).
 */
export function runMigrations(db: Database.Database, migrations: Migration[]): MigrationResult {
  ensureMigrationsTable(db);

  // Validate the list up front: positive, unique versions. A duplicate or a
  // zero/negative version is a programming error, not a runtime condition.
  const seen = new Set<number>();
  for (const m of migrations) {
    if (!Number.isInteger(m.version) || m.version < 1) {
      throw new Error(`Invalid migration version ${m.version} (${m.name}): must be a positive integer`);
    }
    if (seen.has(m.version)) {
      throw new Error(`Duplicate migration version ${m.version} (${m.name})`);
    }
    seen.add(m.version);
  }

  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const done = getAppliedVersions(db);
  const record = db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (version, name) VALUES (?, ?)`);

  const applied: number[] = [];
  const skipped: number[] = [];

  for (const m of ordered) {
    if (done.has(m.version)) {
      skipped.push(m.version);
      continue;
    }
    const tx = db.transaction(() => {
      m.up(db);
      record.run(m.version, m.name);
    });
    try {
      tx();
    } catch (err) {
      // Loud, contextual failure. The transaction already rolled back the DDL +
      // ledger insert, so the DB is left at the previous version, not half-done.
      throw new Error(`Migration v${m.version} (${m.name}) failed: ${getErrorMessage(err)}`);
    }
    applied.push(m.version);
    done.add(m.version);
  }

  const currentVersion = done.size ? Math.max(...done) : 0;
  return { applied, skipped, currentVersion };
}
