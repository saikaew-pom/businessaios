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

/** Insert a media_asset directly and return its id. */
function seedAsset(db: DatabaseSync, overrides: Record<string, any> = {}) {
  const id = 'asset_' + Math.random().toString(36).slice(2);
  const row = {
    user_id: 'u1', generation_id: null, asset_type: 'image', source: 'generation',
    r2_key: `media/${id}.png`, mime_type: 'image/png', file_size: 1024,
    metadata_json: '{}', lifecycle_status: 'active', created_at: 0, updated_at: 0, ...overrides,
  };
  db.prepare(`
    INSERT INTO media_assets (
      id, user_id, generation_id, asset_type, source, r2_key, mime_type, file_size,
      metadata_json, lifecycle_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, row.user_id, row.generation_id, row.asset_type, row.source, row.r2_key, row.mime_type,
    row.file_size, row.metadata_json, row.lifecycle_status, row.created_at, row.updated_at);
  return id;
}

/** Insert a creative_requests row directly and return its id. */
function seedCreativeRequest(db: DatabaseSync, overrides: Record<string, any> = {}) {
  const id = 'creq_' + Math.random().toString(36).slice(2);
  const row = {
    user_id: 'u1', project_id: null, content_item_id: null, source_type: 'content_item',
    source_snapshot_json: '{}', brief_json: '{}', status: 'draft',
    return_route: null, created_at: 0, updated_at: 0, ...overrides,
  };
  db.prepare(`
    INSERT INTO creative_requests (
      id, user_id, project_id, content_item_id, source_type, source_snapshot_json,
      brief_json, status, return_route, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, row.user_id, row.project_id, row.content_item_id, row.source_type, row.source_snapshot_json,
    row.brief_json, row.status, row.return_route, row.created_at, row.updated_at);
  return id;
}

function fulfill(env: any, requestId: string, assetId: string, session = 'session-u1') {
  return app.request(`/api/creative-requests/${requestId}/fulfill`, {
    method: 'POST', headers: H(session), body: JSON.stringify({ asset_id: assetId }),
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

describe('Content item — single-item GET (calendar focus deep link)', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  function getItem(id: string, session = 'session-u1') {
    return app.request(`/api/content-items/${id}`, { headers: H(session) }, ctx.env);
  }

  it('returns the item by id', async () => {
    const id = seedItem(ctx.db, { title: 'Focused item' });
    const res = await getItem(id);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.item.id).toBe(id);
    expect(body.item.title).toBe('Focused item');
  });

  it('includes the primary asset id, same as the list endpoint', async () => {
    const id = seedItem(ctx.db, { status: 'approved' });
    const assetId = seedAsset(ctx.db);
    const now = Date.now();
    ctx.db.prepare(`
      INSERT INTO asset_links (id, user_id, project_id, content_item_id, creative_request_id, generation_id, asset_id, link_role, is_primary, version, metadata_json, created_at, updated_at)
      VALUES ('link1', 'u1', NULL, ?, NULL, NULL, ?, 'primary', 1, 1, '{}', ?, ?)
    `).run(id, assetId, now, now);
    const body = await (await getItem(id)).json() as any;
    expect(body.item.primary_asset_id).toBe(assetId);
  });

  it('404s for a nonexistent item', async () => {
    const res = await getItem('ci_does_not_exist');
    expect(res.status).toBe(404);
  });

  it('does not let a different user fetch someone else\'s item', async () => {
    const id = seedItem(ctx.db);
    const res = await getItem(id, 'session-u2');
    expect(res.status).toBe(404);
  });

  it('rejects a call with no auth header at all', async () => {
    const id = seedItem(ctx.db);
    const res = await app.request(`/api/content-items/${id}`, {}, ctx.env);
    expect(res.status).toBe(401);
  });

  it('is unreachable when the embedded feature flag is off (route matches /api/content-items/* middleware, not just the exact list path)', async () => {
    const id = seedItem(ctx.db);
    const res = await getItem(id);
    // sanity check the flag is on by default in this suite
    expect(res.status).toBe(200);
    const disabled = await app.request(`/api/content-items/${id}`, { headers: H() }, { ...ctx.env, CREATIVE_EMBEDDED_ENABLED: 'false' });
    expect(disabled.status).toBe(404);
    expect(await disabled.json()).toMatchObject({ error: 'feature_disabled' });
  });

  it('does not 500 on a malformed/adversarial id — 404s instead', async () => {
    for (const badId of ["'; DROP TABLE content_items; --", 'a'.repeat(5000), '..%2F..%2Fetc%2Fpasswd']) {
      const res = await app.request(`/api/content-items/${encodeURIComponent(badId)}`, { headers: H() }, ctx.env);
      expect(res.status).toBe(404);
    }
  });
});

describe('Content item — list filtered by scheduled_from/scheduled_to (calendar month range)', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  function list(query: string, session = 'session-u1') {
    return app.request(`/api/content-items?${query}`, { headers: H(session) }, ctx.env);
  }

  it('only returns items whose scheduled_at falls within the given range', async () => {
    const monthStart = Date.parse('2026-08-01T00:00:00Z');
    const monthEnd = Date.parse('2026-09-01T00:00:00Z');
    const inRange = seedItem(ctx.db, { status: 'scheduled', scheduled_at: Date.parse('2026-08-15T09:00:00Z') });
    const beforeRange = seedItem(ctx.db, { status: 'scheduled', scheduled_at: Date.parse('2026-07-30T09:00:00Z') });
    const afterRange = seedItem(ctx.db, { status: 'scheduled', scheduled_at: Date.parse('2026-09-02T09:00:00Z') });
    const res = await list(`status=scheduled&scheduled_from=${monthStart}&scheduled_to=${monthEnd}`);
    const body = await res.json() as any;
    const ids = body.items.map((i: any) => i.id);
    expect(ids).toContain(inRange);
    expect(ids).not.toContain(beforeRange);
    expect(ids).not.toContain(afterRange);
  });

  it('does not filter by schedule range when the params are omitted', async () => {
    const id = seedItem(ctx.db, { status: 'approved', scheduled_at: null });
    const body = await (await list('status=approved')).json() as any;
    expect(body.items.map((i: any) => i.id)).toContain(id);
  });

  it('scheduled_from is inclusive and scheduled_to is exclusive at the exact boundary', async () => {
    // The calendar queries [gridStart, gridEnd) — a 42-cell window — so an
    // item landing exactly on the first visible instant must be included,
    // and one landing exactly on the instant just past the last visible
    // cell (the start of the following, not-shown, day) must be excluded.
    const from = Date.parse('2026-08-01T00:00:00Z');
    const to = Date.parse('2026-09-01T00:00:00Z');
    const atFrom = seedItem(ctx.db, { status: 'scheduled', scheduled_at: from });
    const atTo = seedItem(ctx.db, { status: 'scheduled', scheduled_at: to });
    const justBeforeTo = seedItem(ctx.db, { status: 'scheduled', scheduled_at: to - 1 });
    const body = await (await list(`status=scheduled&scheduled_from=${from}&scheduled_to=${to}`)).json() as any;
    const ids = body.items.map((i: any) => i.id);
    expect(ids).toContain(atFrom); // inclusive lower bound
    expect(ids).toContain(justBeforeTo); // last included instant
    expect(ids).not.toContain(atTo); // exclusive upper bound
  });
});

describe('Creative request — fulfill (Studio → content item link)', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  it('links the asset to the content item, sets it primary, and completes the request', async () => {
    const itemId = seedItem(ctx.db);
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: itemId, return_route: `/works?focus=${itemId}` });
    const assetId = seedAsset(ctx.db);

    const res = await fulfill(ctx.env, reqId, assetId);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.return_route).toBe(`/works?focus=${itemId}`);

    const link = ctx.db.prepare('SELECT * FROM asset_links WHERE content_item_id = ?').get(itemId) as any;
    expect(link.asset_id).toBe(assetId);
    expect(link.is_primary).toBe(1);
    expect(link.creative_request_id).toBe(reqId);

    const req = ctx.db.prepare('SELECT status FROM creative_requests WHERE id = ?').get(reqId) as any;
    expect(req.status).toBe('completed');

    // primary_asset_id now resolves via the list endpoint's subquery
    const list = await app.request('/api/content-items', { headers: H() }, ctx.env);
    const items = (await list.json() as any).items;
    expect(items.find((i: any) => i.id === itemId).primary_asset_id).toBe(assetId);
  });

  it('demotes the previous primary and bumps version when a second asset is attached', async () => {
    const itemId = seedItem(ctx.db);
    const req1 = seedCreativeRequest(ctx.db, { content_item_id: itemId });
    const asset1 = seedAsset(ctx.db);
    await fulfill(ctx.env, req1, asset1);

    const req2 = seedCreativeRequest(ctx.db, { content_item_id: itemId });
    const asset2 = seedAsset(ctx.db);
    await fulfill(ctx.env, req2, asset2);

    const links = ctx.db.prepare('SELECT asset_id, is_primary, version FROM asset_links WHERE content_item_id = ? ORDER BY version ASC').all(itemId) as any[];
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ asset_id: asset1, is_primary: 0, version: 1 });
    expect(links[1]).toMatchObject({ asset_id: asset2, is_primary: 1, version: 2 });
  });

  it('404s when the request belongs to a different user', async () => {
    const itemId = seedItem(ctx.db);
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: itemId });
    const assetId = seedAsset(ctx.db);
    const res = await fulfill(ctx.env, reqId, assetId, 'session-u2');
    expect(res.status).toBe(404);
  });

  it('404s when the asset belongs to a different user (cannot attach someone else\'s asset)', async () => {
    const itemId = seedItem(ctx.db);
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: itemId });
    const foreignAsset = seedAsset(ctx.db, { user_id: 'u2' });
    const res = await fulfill(ctx.env, reqId, foreignAsset);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'asset_not_found' });
  });

  it('400s when the creative request has no content_item_id', async () => {
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: null });
    const assetId = seedAsset(ctx.db);
    const res = await fulfill(ctx.env, reqId, assetId);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'request_has_no_content_item' });
  });

  it('400s when asset_id is missing', async () => {
    const itemId = seedItem(ctx.db);
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: itemId });
    const res = await app.request(`/api/creative-requests/${reqId}/fulfill`, { method: 'POST', headers: H(), body: JSON.stringify({}) }, ctx.env);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'asset_id_required' });
  });

  it('404s for a nonexistent creative request', async () => {
    const assetId = seedAsset(ctx.db);
    const res = await fulfill(ctx.env, 'creq_does_not_exist', assetId);
    expect(res.status).toBe(404);
  });

  it('rejects a fulfill call with no auth header at all (not just wrong-owner)', async () => {
    const itemId = seedItem(ctx.db);
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: itemId });
    const assetId = seedAsset(ctx.db);
    const res = await app.request(`/api/creative-requests/${reqId}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // no Authorization
      body: JSON.stringify({ asset_id: assetId }),
    }, ctx.env);
    expect(res.status).toBe(401);
  });

  it('rejects a fulfill call when the embedded feature flag is off', async () => {
    const itemId = seedItem(ctx.db);
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: itemId });
    const assetId = seedAsset(ctx.db);
    const res = await fulfill({ ...ctx.env, CREATIVE_EMBEDDED_ENABLED: 'false' }, reqId, assetId);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'feature_disabled' });
  });

  it('is idempotent when the same request is fulfilled twice (e.g. a stale concurrent poll tick) — does not double-attach', async () => {
    const itemId = seedItem(ctx.db);
    const reqId = seedCreativeRequest(ctx.db, { content_item_id: itemId, return_route: `/works?focus=${itemId}` });
    const assetId = seedAsset(ctx.db);

    const first = await fulfill(ctx.env, reqId, assetId);
    expect(first.status).toBe(200);
    const second = await fulfill(ctx.env, reqId, assetId);
    expect(second.status).toBe(200);
    const secondBody = await second.json() as any;
    expect(secondBody.ok).toBe(true);
    expect(secondBody.return_route).toBe(`/works?focus=${itemId}`);

    // Only one asset_link should have been created — the second call must not
    // insert a duplicate row or bump the version again.
    const links = ctx.db.prepare('SELECT asset_id, is_primary, version FROM asset_links WHERE content_item_id = ?').all(itemId) as any[];
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ asset_id: assetId, is_primary: 1, version: 1 });

    const req = ctx.db.prepare('SELECT status FROM creative_requests WHERE id = ?').get(reqId) as any;
    expect(req.status).toBe('completed');
  });
});
