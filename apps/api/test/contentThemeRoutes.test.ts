/**
 * Content Playbook Upgrade Plan ขั้นที่ 2 — ownership scoping and
 * confirm-batch integrity for /api/content-themes*. Driven through the real
 * HTTP app + D1 shim + migrations (same pattern as contentRoutes.test.ts),
 * not mocks of the code under test. Only covers routes that don't require an
 * AI call (suggest/topics-suggest are excluded — those were live-tested
 * against wrangler dev + MiniMax separately).
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
  if (!userColumns.includes('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, email_verified, created_at, updated_at)
    VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 'user', 100, 1, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, email_verified, created_at, updated_at)
    VALUES ('u2', 'u2@test.com', 'x', 'User Two', 'free', 'user', 100, 1, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u2', 'u2', ${Date.now() + 60_000}, 0);
  `);
  seedBrandProfile(db, 'brand-a', 'u1');
  seedBrandProfile(db, 'brand-b', 'u1');
  seedBrandProfile(db, 'brand-victim', 'u2');
  return {
    db,
    env: {
      DB: makeD1Shim(db),
      ALLOWED_ORIGIN: 'http://localhost:5173',
      CONTENT_SERIES_ENABLED: 'true',
    } as any,
  };
}

const H = (session = 'session-u1') => ({ Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' });

function seedBrandProfile(db: DatabaseSync, id: string, userId: string) {
  db.prepare(`
    INSERT INTO brand_profiles (
      id, user_id, name, business_summary, audience_json, tone_of_voice_json,
      content_pillars_json, offers_json, rules_json, default_reference_asset_ids_json,
      created_at, updated_at
    ) VALUES (?, ?, 'Brand', '', '[]', '[]', '[]', '[]', '{}', '[]', 0, 0)
  `).run(id, userId);
}

function seedTheme(db: DatabaseSync, id: string, userId: string, brandProfileId: string, status = 'suggested') {
  db.prepare(`
    INSERT INTO content_themes (id, user_id, brand_profile_id, name, reason, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `).run(id, userId, brandProfileId, `Theme ${id}`, 'reason', status);
}

describe('POST /api/content-themes/confirm-batch', () => {
  it('rejects a batch mixing theme_ids from two different brand profiles of the SAME user', async () => {
    const { db, env } = makeEnv();
    seedTheme(db, 'theme-a', 'u1', 'brand-a');
    seedTheme(db, 'theme-b', 'u1', 'brand-b');

    const res = await app.request('/api/content-themes/confirm-batch', {
      method: 'POST', headers: H(), body: JSON.stringify({ theme_ids: ['theme-a', 'theme-b'] }),
    }, env);

    // Must NOT silently succeed: confirming across two brand profiles in one
    // batch leaves one profile's content_pillars_json unsynced while the
    // theme itself is marked 'confirmed' — an inconsistent state.
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe('theme_brand_profile_mismatch');

    // Neither theme should have been mutated.
    const rows = db.prepare('SELECT id, status FROM content_themes ORDER BY id').all() as any[];
    expect(rows.find((r) => r.id === 'theme-a')?.status).toBe('suggested');
    expect(rows.find((r) => r.id === 'theme-b')?.status).toBe('suggested');
  });

  it('confirms a batch that shares one brand profile and syncs content_pillars_json', async () => {
    const { db, env } = makeEnv();
    seedTheme(db, 'theme-a', 'u1', 'brand-a');
    seedTheme(db, 'theme-c', 'u1', 'brand-a');

    const res = await app.request('/api/content-themes/confirm-batch', {
      method: 'POST', headers: H(), body: JSON.stringify({ theme_ids: ['theme-a', 'theme-c'] }),
    }, env);
    expect(res.status).toBe(200);

    const brand = db.prepare('SELECT content_pillars_json FROM brand_profiles WHERE id = ?').get('brand-a') as any;
    const pillars = JSON.parse(brand.content_pillars_json);
    expect(pillars.sort()).toEqual(['Theme theme-a', 'Theme theme-c'].sort());
  });

  it('rejects (404) a batch containing another user\'s theme id, without confirming any of it', async () => {
    const { db, env } = makeEnv();
    seedTheme(db, 'theme-mine', 'u1', 'brand-a');
    seedTheme(db, 'theme-victim', 'u2', 'brand-victim');

    const res = await app.request('/api/content-themes/confirm-batch', {
      method: 'POST', headers: H('session-u1'), body: JSON.stringify({ theme_ids: ['theme-mine', 'theme-victim'] }),
    }, env);
    expect(res.status).toBe(404);

    const rows = db.prepare('SELECT id, status FROM content_themes ORDER BY id').all() as any[];
    expect(rows.find((r) => r.id === 'theme-mine')?.status).toBe('suggested');
    expect(rows.find((r) => r.id === 'theme-victim')?.status).toBe('suggested');
  });
});

describe('GET/POST /api/content-themes/:id/topics ownership scoping', () => {
  it('returns 404 for a theme owned by another user (list)', async () => {
    const { db, env } = makeEnv();
    seedTheme(db, 'theme-victim', 'u2', 'brand-victim', 'confirmed');

    const res = await app.request('/api/content-themes/theme-victim/topics', { headers: H('session-u1') }, env);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a theme owned by another user (suggest) without spending credits', async () => {
    const { db, env } = makeEnv();
    seedTheme(db, 'theme-victim', 'u2', 'brand-victim', 'confirmed');

    const before = db.prepare('SELECT credits FROM users WHERE id = ?').get('u1') as any;
    const res = await app.request('/api/content-themes/theme-victim/topics/suggest', {
      method: 'POST', headers: H('session-u1'),
    }, env);
    expect(res.status).toBe(404);
    const after = db.prepare('SELECT credits FROM users WHERE id = ?').get('u1') as any;
    expect(after.credits).toBe(before.credits);
  });
});
