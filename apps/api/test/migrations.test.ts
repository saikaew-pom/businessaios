/**
 * Migration gate test.
 *
 * Applies every migration file in apps/api/migrations/ against a fresh
 * in-memory SQLite database, in the SAME ORDER `wrangler d1 migrations
 * apply` uses on a brand-new database — a NATURAL sort of filenames
 * (numeric-aware), NOT a plain lexicographic string sort. This matters a
 * lot: plain `.sort()` puts "0003_mvp_clean.sql" *before* "001-v2.sql"
 * (since '0' < '1' at the 3rd character), which is NOT what
 * `wrangler d1 migrations apply` actually does — verified empirically
 * against real `wrangler d1 migrations list` output, which applies
 * 0001_init.sql, then 001-v2.sql, then 002-..., THEN 0003_mvp_clean.sql.
 * Getting this wrong would make this test give false confidence.
 *
 * This exists because `0003_mvp_clean.sql` drops and recreates `users`/
 * `projects`/etc. without the columns/tables that `001-v2.sql` and
 * `002-context-and-links.sql` add. See docs/AUDIT.md for the full incident.
 *
 * Two levels of guarantee, tested separately, because they're genuinely
 * different claims:
 *   1. Auto-applied migrations alone (`wrangler d1 migrations apply`) —
 *      fixes `api_keys`/`tool_runs` (006/007, safe `CREATE TABLE IF NOT
 *      EXISTS`), but users/projects columns are a KNOWN, documented gap
 *      (see manual-repairs/manual-repair-fresh-env.sql's header for why
 *      that repair isn't auto-applied: it uses ALTER TABLE ADD COLUMN,
 *      which would error on production where those columns already exist
 *      from a different real historical apply order).
 *   2. The full documented fresh-environment setup procedure — auto
 *      migrations, THEN the manual repair script — which IS expected to
 *      produce a fully correct schema, and is what STATUS.md/AUDIT.md tell
 *      anyone standing up a new environment to do.
 *
 * Deliberately does NOT test against production — production's migrations
 * were applied by hand over time in a different real order, which is a
 * separate, already-documented risk (see docs/AUDIT.md).
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const MANUAL_REPAIR_FILE = join(__dirname, '..', 'manual-repairs', 'manual-repair-fresh-env.sql');

function naturalSort(files: string[]): string[] {
  return [...files].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function applyMigrations(db: DatabaseSync) {
  const files = naturalSort(readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
  }
}

function columnNames(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((c) => c.name as string);
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
    .get(table);
  return !!row;
}

const REQUIRED_TABLES = [
  'users', 'sessions', 'projects', 'generations', 'exports', 'api_keys',
  'tool_runs', 'tool_saves', 'tool_save_exports', 'email_verifications',
  'otp_codes', 'credit_transactions', 'rate_limits', 'step_assets',
  'project_links', 'admin_actions', 'email_outbox',
];

describe('auto-applied migrations alone (`wrangler d1 migrations apply`)', () => {
  let db: DatabaseSync;

  beforeAll(() => {
    db = new DatabaseSync(':memory:');
    applyMigrations(db);
  });

  it('creates every table the API code depends on', () => {
    for (const table of REQUIRED_TABLES) {
      expect(tableExists(db, table), `expected table "${table}" to exist`).toBe(true);
    }
  });

  it('api_keys and tool_runs are usable, not just present in name (006/007 regression guard)', () => {
    // A real INSERT, not just a schema-presence check — this is what
    // actually broke in production before 006/007 existed (missing table
    // showed up as a runtime 500 on first write, not at migration-apply time).
    db.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
             VALUES ('u1', 'u1@test.com', 'x', 'free', 0, 0)`);
    expect(() =>
      db.exec(`INSERT INTO api_keys (id, user_id, provider, encrypted_key, created_at)
               VALUES ('k1', 'u1', 'openai', 'ciphertext', 0)`)
    ).not.toThrow();
    expect(() =>
      db.exec(`INSERT INTO tool_runs (id, user_id, tool_name, created_at)
               VALUES ('t1', 'u1', 'pain_generator', 0)`)
    ).not.toThrow();
  });

  it('KNOWN GAP: users/projects columns from 001-v2/002 are wiped by 0003_mvp_clean on a fresh apply', () => {
    // This is intentionally documenting a real, currently-unfixed-by-
    // automation gap, not asserting desired behavior. If this ever starts
    // failing (i.e. the columns ARE present), that's good news — update
    // this test and manual-repairs/manual-repair-fresh-env.sql's header.
    expect(columnNames(db, 'users')).not.toContain('first_name');
    expect(columnNames(db, 'projects')).not.toContain('kind');
  });
});

describe('full documented fresh-environment setup (migrations + manual-repairs/manual-repair-fresh-env.sql)', () => {
  let db: DatabaseSync;

  beforeAll(() => {
    db = new DatabaseSync(':memory:');
    applyMigrations(db);
    db.exec(readFileSync(MANUAL_REPAIR_FILE, 'utf-8'));
  });

  it('users has every column the API reads/writes', () => {
    const cols = columnNames(db, 'users');
    for (const col of [
      'id', 'email', 'password_hash', 'name', 'first_name', 'last_name',
      'phone', 'avatar_url', 'role', 'email_verified', 'email_verified_at',
      'two_factor_enabled', 'credits', 'totp_secret', 'plan', 'locale',
    ]) {
      expect(cols, `expected users.${col} to exist`).toContain(col);
    }
  });

  it('projects has the `kind` column (drives per-tool project filtering)', () => {
    expect(columnNames(db, 'projects')).toContain('kind');
  });

  it('still has every required table', () => {
    for (const table of REQUIRED_TABLES) {
      expect(tableExists(db, table), `expected table "${table}" to exist`).toBe(true);
    }
  });
});
