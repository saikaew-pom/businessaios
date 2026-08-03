/**
 * Admin support action: POST /api/admin/users/:id/mark-verified — manually
 * mark a user's email verified (escape hatch for verification-email
 * deliverability failures). Driven through the real HTTP app + D1 shim +
 * migrations, same pattern as contentRoutes.test.ts. Covers the authz gate
 * (401/403), the actual state transition + audit row, and both error paths
 * (already_verified, not_found).
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import { makeD1Shim } from './helpers/d1-shim';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

function applyMigrations(db: DatabaseSync) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const file of files) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
}

function makeEnv() {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db);
  const userColumns = (db.prepare('PRAGMA table_info(users)').all() as any[]).map((c) => c.name);
  if (!userColumns.includes('credits')) db.exec('ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100');
  if (!userColumns.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  // The sorted-migration replay runs 0003 (schema reset) after 001-v2, dropping
  // the v2 user columns — re-add the ones this route touches, same as credits/role above.
  if (!userColumns.includes('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
  if (!userColumns.includes('email_verified_at')) db.exec('ALTER TABLE users ADD COLUMN email_verified_at INTEGER');
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, email_verified, created_at, updated_at)
    VALUES ('admin1', 'admin@test.com', 'x', 'Admin', 'free', 'admin', 100, 1, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, email_verified, created_at, updated_at)
    VALUES ('stuck1', 'stuck@test.com', 'x', 'Stuck User', 'free', 'user', 100, 0, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, email_verified, created_at, updated_at)
    VALUES ('done1', 'done@test.com', 'x', 'Verified User', 'free', 'user', 100, 1, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-admin', 'admin1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-stuck', 'stuck1', ${Date.now() + 60_000}, 0);
  `);
  return {
    db,
    env: {
      DB: makeD1Shim(db),
      ALLOWED_ORIGIN: 'http://localhost:5173',
    } as any,
  };
}

const H = (session: string) => ({ Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' });

function markVerified(env: any, id: string, session?: string) {
  return app.request(`/api/admin/users/${id}/mark-verified`, {
    method: 'POST',
    headers: session ? H(session) : { 'Content-Type': 'application/json' },
  }, env);
}

describe('POST /api/admin/users/:id/mark-verified', () => {
  let db: DatabaseSync;
  let env: any;

  beforeEach(() => {
    ({ db, env } = makeEnv());
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await markVerified(env, 'stuck1');
    expect(res.status).toBe(401);
    const row = db.prepare('SELECT email_verified FROM users WHERE id = ?').get('stuck1') as any;
    expect(row.email_verified).toBe(0);
  });

  it('rejects non-admin sessions with 403 and does not touch the user', async () => {
    const res = await markVerified(env, 'stuck1', 'session-stuck');
    expect(res.status).toBe(403);
    const row = db.prepare('SELECT email_verified FROM users WHERE id = ?').get('stuck1') as any;
    expect(row.email_verified).toBe(0);
    const actions = db.prepare("SELECT COUNT(*) as c FROM admin_actions WHERE action = 'mark_verified'").get() as any;
    expect(actions.c).toBe(0);
  });

  it('marks an unverified user verified and writes the audit row', async () => {
    const before = Date.now();
    const res = await markVerified(env, 'stuck1', 'session-admin');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const row = db.prepare('SELECT email_verified, email_verified_at, updated_at FROM users WHERE id = ?')
      .get('stuck1') as any;
    expect(row.email_verified).toBe(1);
    expect(row.email_verified_at).toBeGreaterThanOrEqual(before);
    expect(row.updated_at).toBe(row.email_verified_at);

    const action = db.prepare(
      "SELECT admin_id, target_user_id, details FROM admin_actions WHERE action = 'mark_verified'"
    ).get() as any;
    expect(action.admin_id).toBe('admin1');
    expect(action.target_user_id).toBe('stuck1');
    expect(action.details).toBe('{}');
  });

  it('returns 400 already_verified for a user who is already verified', async () => {
    const res = await markVerified(env, 'done1', 'session-admin');
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('already_verified');
    const actions = db.prepare("SELECT COUNT(*) as c FROM admin_actions WHERE action = 'mark_verified'").get() as any;
    expect(actions.c).toBe(0);
  });

  it('returns 404 for an unknown user id', async () => {
    const res = await markVerified(env, 'no-such-user', 'session-admin');
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe('not_found');
  });
});
