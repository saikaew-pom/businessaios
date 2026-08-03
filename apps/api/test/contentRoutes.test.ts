/**
 * Content item lifecycle — Stage 1 backend foundation for the Works→Calendar
 * flow. Covers the new transitions (revert_to_draft, reschedule) and the
 * PATCH content-edit endpoint, plus the ownership/whitelist guards that keep
 * them from being abused. Driven through the real HTTP app + D1 shim +
 * migrations, not mocks of the code under test.
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
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 'user', 100, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('u2', 'u2@test.com', 'x', 'User Two', 'free', 'user', 100, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u2', 'u2', ${Date.now() + 60_000}, 0);
  `);
  return {
    db,
    env: {
      DB: makeD1Shim(db),
      ALLOWED_ORIGIN: 'http://localhost:5173',
      CREATIVE_EMBEDDED_ENABLED: 'true',
    } as any,
  };
}

const H = (session = 'session-u1') => ({ Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' });

/** Insert a content_item directly and return its id. */
function seedItem(db: DatabaseSync, overrides: Record<string, any> = {}) {
  const id = 'ci_' + Math.random().toString(36).slice(2);
  const row = {
    user_id: 'u1', project_id: null, source_type: 'test', source_id: null,
    source_hash: id, title: 'Original title', platform: 'facebook', format: 'post',
    pillar: 'education', hook: 'Original hook', caption: 'Original caption', cta: 'ทักแชท',
    hashtags_json: '["#a"]', visual_suggestion: 'a photo', expected_engagement: 'high',
    status: 'pending_review', scheduled_at: null, timezone: null,
    approved_at: null, approved_by: null, rejected_at: null, rejected_by: null, rejection_reason: null,
    metadata_json: '{}', created_at: 0, updated_at: 0, ...overrides,
  };
  db.prepare(`
    INSERT INTO content_items (
      id, user_id, project_id, source_type, source_id, source_hash, title, platform, format,
      pillar, hook, caption, cta, hashtags_json, visual_suggestion, expected_engagement, status,
      scheduled_at, timezone, approved_at, approved_by, rejected_at, rejected_by, rejection_reason,
      metadata_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id, row.user_id, row.project_id, row.source_type, row.source_id, row.source_hash, row.title,
    row.platform, row.format, row.pillar, row.hook, row.caption, row.cta, row.hashtags_json,
    row.visual_suggestion, row.expected_engagement, row.status, row.scheduled_at, row.timezone,
    row.approved_at, row.approved_by, row.rejected_at, row.rejected_by, row.rejection_reason,
    row.metadata_json, row.created_at, row.updated_at,
  );
  return id;
}

function transition(env: any, id: string, action: string, extra: Record<string, unknown> = {}, session = 'session-u1') {
  return app.request(`/api/content-items/${id}/transition`, {
    method: 'POST', headers: H(session), body: JSON.stringify({ action, ...extra }),
  }, env);
}

describe('Content item — revert_to_draft transition', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  it('reverts an approved item to draft and clears approval metadata', async () => {
    const id = seedItem(ctx.db, { status: 'approved', approved_at: 123, approved_by: 'u1' });
    const res = await transition(ctx.env, id, 'revert_to_draft');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.item.status).toBe('draft');
    expect(body.item.approved_at).toBeNull();
    expect(body.item.approved_by).toBeNull();
  });

  it('reverts a scheduled item to draft and clears the schedule', async () => {
    const id = seedItem(ctx.db, { status: 'scheduled', scheduled_at: Date.now() + 86_400_000, timezone: 'Asia/Bangkok', approved_at: 1, approved_by: 'u1' });
    const res = await transition(ctx.env, id, 'revert_to_draft');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.item.status).toBe('draft');
    expect(body.item.scheduled_at).toBeNull();
    expect(body.item.timezone).toBeNull();
  });

  it('reverts a rejected item to draft and clears the rejection reason', async () => {
    const id = seedItem(ctx.db, { status: 'rejected', rejected_at: 1, rejected_by: 'u1', rejection_reason: 'off brand' });
    const body = await (await transition(ctx.env, id, 'revert_to_draft')).json() as any;
    expect(body.item.status).toBe('draft');
    expect(body.item.rejection_reason).toBeNull();
  });

  it('refuses to revert a published (terminal) item', async () => {
    const id = seedItem(ctx.db, { status: 'published' });
    const res = await transition(ctx.env, id, 'revert_to_draft');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'invalid_transition' });
  });

  it('does not let a different user revert someone else\'s item', async () => {
    const id = seedItem(ctx.db, { status: 'approved' });
    const res = await transition(ctx.env, id, 'revert_to_draft', {}, 'session-u2');
    expect(res.status).toBe(404);
  });
});

describe('Content item — reschedule transition', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  it('schedules an approved item to a future date', async () => {
    const id = seedItem(ctx.db, { status: 'approved' });
    const when = Date.now() + 86_400_000;
    const body = await (await transition(ctx.env, id, 'reschedule', { scheduled_at: when, timezone: 'Asia/Bangkok' })).json() as any;
    expect(body.item.status).toBe('scheduled');
    expect(body.item.scheduled_at).toBe(when);
    expect(body.item.timezone).toBe('Asia/Bangkok');
  });

  it('moves an already-scheduled item to a new date without an unschedule round trip', async () => {
    const id = seedItem(ctx.db, { status: 'scheduled', scheduled_at: Date.now() + 86_400_000, timezone: 'Asia/Bangkok' });
    const newWhen = Date.now() + 3 * 86_400_000;
    const body = await (await transition(ctx.env, id, 'reschedule', { scheduled_at: newWhen })).json() as any;
    expect(body.item.status).toBe('scheduled');
    expect(body.item.scheduled_at).toBe(newWhen);
    expect(body.item.timezone).toBe('Asia/Bangkok'); // preserved from the prior schedule
  });

  it('rejects a past scheduled time', async () => {
    const id = seedItem(ctx.db, { status: 'approved' });
    const res = await transition(ctx.env, id, 'reschedule', { scheduled_at: Date.now() - 1000 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_schedule_time' });
  });

  it('refuses to reschedule an item that was never approved', async () => {
    const id = seedItem(ctx.db, { status: 'pending_review' });
    const res = await transition(ctx.env, id, 'reschedule', { scheduled_at: Date.now() + 86_400_000 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'approval_required' });
  });

  it('does not let a different user reschedule someone else\'s item', async () => {
    const id = seedItem(ctx.db, { status: 'approved' });
    const res = await transition(ctx.env, id, 'reschedule', { scheduled_at: Date.now() + 86_400_000 }, 'session-u2');
    expect(res.status).toBe(404);
    const row = ctx.db.prepare('SELECT status, scheduled_at FROM content_items WHERE id = ?').get(id) as any;
    expect(row.status).toBe('approved'); // unchanged
    expect(row.scheduled_at).toBeNull(); // never scheduled
  });
});

describe('Content item — PATCH edit', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  function patch(id: string, body: Record<string, unknown>, session = 'session-u1') {
    return app.request(`/api/content-items/${id}`, { method: 'PATCH', headers: H(session), body: JSON.stringify(body) }, ctx.env);
  }

  it('edits authored fields and returns the updated item', async () => {
    const id = seedItem(ctx.db);
    const res = await patch(id, { title: 'New title', caption: 'New caption', hashtags: ['#x', '#y'] });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.item.title).toBe('New title');
    expect(body.item.caption).toBe('New caption');
    expect(body.item.hashtags).toEqual(['#x', '#y']);
  });

  it('ignores non-editable fields (cannot smuggle status, user_id, or scheduled_at)', async () => {
    const id = seedItem(ctx.db, { status: 'pending_review' });
    const res = await patch(id, { status: 'approved', user_id: 'u2', scheduled_at: 999, title: 'ok' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.item.status).toBe('pending_review'); // untouched
    expect(body.item.user_id).toBe('u1'); // untouched
    expect(body.item.scheduled_at).toBeNull(); // untouched
    expect(body.item.title).toBe('ok'); // the one allowed field applied
  });

  it('400s when the payload has no editable fields', async () => {
    const id = seedItem(ctx.db);
    const res = await patch(id, { status: 'approved' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'no_editable_fields' });
  });

  it('sanitizes hashtags (drops non-strings, caps length)', async () => {
    const id = seedItem(ctx.db);
    const body = await (await patch(id, { hashtags: ['#ok', 42, { bad: 1 }, '#also'] })).json() as any;
    expect(body.item.hashtags).toEqual(['#ok', '#also']);
  });

  it('does not let a different user edit someone else\'s item', async () => {
    const id = seedItem(ctx.db);
    const res = await patch(id, { title: 'hijacked' }, 'session-u2');
    expect(res.status).toBe(404);
    const row = ctx.db.prepare('SELECT title FROM content_items WHERE id = ?').get(id) as any;
    expect(row.title).toBe('Original title');
  });

  it('404s for a nonexistent item', async () => {
    const res = await patch('ci_does_not_exist', { title: 'x' });
    expect(res.status).toBe(404);
  });

  it('does not 500 on a non-object JSON body (null / number)', async () => {
    const id = seedItem(ctx.db);
    for (const raw of ['null', '5', '"str"']) {
      const res = await app.request(`/api/content-items/${id}`, { method: 'PATCH', headers: H(), body: raw }, ctx.env);
      expect(res.status).toBe(400); // coerced to empty payload → no_editable_fields, not a crash
      expect(await res.json()).toMatchObject({ error: 'no_editable_fields' });
    }
  });
});
