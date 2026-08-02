/**
 * Content Series Generator — HTTP-route-driven tests against the real D1
 * shim + migrations (not mocks of the thing under test). Covers: the
 * admin/user template visibility split, the reserve→generate→true-up credit
 * flow (including the insufficient-credits and AI-failure refund paths),
 * and that generated content_items land in content_items with a traceable
 * series_id/series_slot_index.
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import { makeD1Shim } from './helpers/d1-shim';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

function applyMigrations(db: DatabaseSync) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const file of files) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
}

function makeEnv(opts: { enabled?: boolean } = {}) {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db);
  const userColumns = (db.prepare('PRAGMA table_info(users)').all() as any[]).map((c) => c.name);
  if (!userColumns.includes('credits')) db.exec('ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100');
  if (!userColumns.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 'user', 100, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('u2', 'u2@test.com', 'x', 'User Two', 'free', 'user', 5, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('admin1', 'admin@test.com', 'x', 'Admin One', 'free', 'admin', 100, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u2', 'u2', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-admin', 'admin1', ${Date.now() + 60_000}, 0);
  `);
  return {
    db,
    env: {
      DB: makeD1Shim(db),
      ALLOWED_ORIGIN: 'http://localhost:5173',
      RESEND_FROM_EMAIL: 'test@example.com',
      NOTIFY_EMAIL: 'test@example.com',
      MINIMAX_MODEL: 'MiniMax-M3',
      MINIMAX_API_KEY: 'test-key',
      MINIMAX_GROUP_ID: 'test-group',
      MASTER_ENCRYPTION_KEY: 'test-master-encryption-key',
      API_URL: 'https://api.test',
      CREATIVE_STUDIO_ENABLED: 'true',
      CREATIVE_EMBEDDED_ENABLED: 'true',
      BRAND_CONTEXT_ENABLED: 'true',
      CONTENT_SERIES_ENABLED: opts.enabled === false ? 'false' : 'true',
    } as any,
  };
}

function mockMinimaxSuccess(count: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    slot_index: i,
    pillar: 'education',
    platform: 'facebook',
    hook: `Hook ${i}`,
    caption: `Caption ${i}`,
    cta: 'ทักแชท',
    hashtags: ['#test'],
    visual_suggestion: 'a photo',
  }));
  return vi.fn(async () => new Response(JSON.stringify({
    id: 'gen-1',
    choices: [{ message: { role: 'assistant', content: JSON.stringify({ items }) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  }), { status: 200 }));
}

describe('Content Series Generator', () => {
  let ctx: ReturnType<typeof makeEnv>;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('feature gate', () => {
    it('404s when the flag is off', async () => {
      ctx = makeEnv({ enabled: false });
      const res = await app.request('/api/content-series/templates', { headers: { Authorization: 'Bearer session-u1' } }, ctx.env);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: 'feature_disabled' });
    });
  });

  describe('template visibility split', () => {
    beforeEach(() => { ctx = makeEnv(); });

    it('lets a regular user create only a private template, never a global one', async () => {
      const forbidden = await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sneaky Global', owner_type: 'admin' }),
      }, ctx.env);
      expect(forbidden.status).toBe(403);

      const created = await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Private Template', slots: [{ pillar: 'awareness' }] }),
      }, ctx.env);
      expect(created.status).toBe(201);
      const template = await created.json() as any;
      expect(template.owner_type).toBe('user');
    });

    it('shows admin-global templates to every user, but private templates only to their owner', async () => {
      await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Global Template', owner_type: 'admin', slots: [{ pillar: 'education' }] }),
      }, ctx.env);
      await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'U1 Private Template' }),
      }, ctx.env);

      const u1List = await (await app.request('/api/content-series/templates', { headers: { Authorization: 'Bearer session-u1' } }, ctx.env)).json() as any;
      expect(u1List.templates.map((t: any) => t.name).sort()).toEqual(['Global Template', 'U1 Private Template']);

      const u2List = await (await app.request('/api/content-series/templates', { headers: { Authorization: 'Bearer session-u2' } }, ctx.env)).json() as any;
      expect(u2List.templates.map((t: any) => t.name)).toEqual(['Global Template']);
    });

    it('blocks a user from editing another user\'s private template or an admin-owned global template', async () => {
      const created = await (await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'U1 Template' }),
      }, ctx.env)).json() as any;
      const globalTpl = await (await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Global', owner_type: 'admin' }),
      }, ctx.env)).json() as any;

      const editOther = await app.request(`/api/content-series/templates/${created.id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer session-u2', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'hijacked' }),
      }, ctx.env);
      expect(editOther.status).toBe(403);

      const editGlobalAsUser = await app.request(`/api/content-series/templates/${globalTpl.id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'hijacked' }),
      }, ctx.env);
      expect(editGlobalAsUser.status).toBe(403);

      const editGlobalAsAdmin = await app.request(`/api/content-series/templates/${globalTpl.id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Global v2' }),
      }, ctx.env);
      expect(editGlobalAsAdmin.status).toBe(200);
    });

    it('deletes (soft) only templates the caller owns or administers, and the delete drops it from listings', async () => {
      const owned = await (await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'U1 Deletable' }),
      }, ctx.env)).json() as any;

      const deleteByOtherUser = await app.request(`/api/content-series/templates/${owned.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer session-u2' },
      }, ctx.env);
      expect(deleteByOtherUser.status).toBe(403);

      const deleteByOwner = await app.request(`/api/content-series/templates/${owned.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer session-u1' },
      }, ctx.env);
      expect(deleteByOwner.status).toBe(200);

      const listAfter = await (await app.request('/api/content-series/templates', { headers: { Authorization: 'Bearer session-u1' } }, ctx.env)).json() as any;
      expect(listAfter.templates.map((t: any) => t.id)).not.toContain(owned.id);

      const deleteUnknown = await app.request('/api/content-series/templates/nonexistent', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer session-u1' },
      }, ctx.env);
      expect(deleteUnknown.status).toBe(404);
    });
  });

  describe('series generation', () => {
    beforeEach(() => { ctx = makeEnv(); });

    it('validates topic and requested_count before spending any credits', async () => {
      const before = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any;
      const res = await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: '', requested_count: 0 }),
      }, ctx.env);
      expect(res.status).toBe(400);
      const after = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any;
      expect(after.credits).toBe(before.credits);
    });

    it('generates N content_items traceable to the series via series_id/series_slot_index, and charges real usage not the estimate', async () => {
      globalThis.fetch = mockMinimaxSuccess(5) as any;
      const res = await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'เปิดร้านกาแฟ', requested_count: 5, cadence_days: 2 }),
      }, ctx.env);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.series.status).toBe('completed');
      expect(body.series.generated_count).toBe(5);
      expect(body.items).toHaveLength(5);
      expect(body.items.map((i: any) => i.series_slot_index)).toEqual([0, 1, 2, 3, 4]);
      expect(body.items.every((i: any) => i.series_id === body.series.id)).toBe(true);

      // scheduled_at should be spaced by cadence_days (2 days = 172,800,000ms)
      const scheduled = body.items.map((i: any) => i.scheduled_at).sort((a: number, b: number) => a - b);
      expect(scheduled[1] - scheduled[0]).toBe(2 * 86_400_000);

      // credits_used on the series should reflect the mocked usage
      // (calculateCredits({prompt:100, completion:200}) = ceil(0.1 + 0.4) = 1),
      // not the up-front `requested_count * 8` estimate — proves the
      // true-up/refund path actually ran instead of just keeping the reserve.
      const user = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any;
      expect(user.credits).toBe(99); // 100 - 1 credit actually used
      expect(body.series.credits_used).toBe(1);
    });

    it('refunds the full reservation when the AI call fails, leaving the user unharmed', async () => {
      globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as any;
      const res = await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'เปิดร้านกาแฟ', requested_count: 5 }),
      }, ctx.env);
      expect(res.status).toBe(500);
      const user = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any;
      expect(user.credits).toBe(100); // fully refunded

      const series = ctx.db.prepare("SELECT status FROM content_series WHERE user_id = 'u1'").get() as any;
      expect(series.status).toBe('failed');

      const items = ctx.db.prepare("SELECT COUNT(*) as n FROM content_items WHERE user_id = 'u1'").get() as any;
      expect(items.n).toBe(0);
    });

    it('rejects generation for a user with insufficient credits without calling the AI', async () => {
      const fetchSpy = mockMinimaxSuccess(30);
      globalThis.fetch = fetchSpy as any;
      // u2 has 5 credits; requesting 30 items estimates 30*8=240 reserve credits
      const res = await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u2', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'เปิดร้านกาแฟ', requested_count: 30 }),
      }, ctx.env);
      expect(res.status).toBe(402);
      expect(fetchSpy).not.toHaveBeenCalled();
      const user = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u2'").get() as any;
      expect(user.credits).toBe(5); // untouched
    });

    it('rejects an unknown or invisible template_id', async () => {
      globalThis.fetch = mockMinimaxSuccess(3) as any;
      const res = await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'x', requested_count: 3, template_id: 'nonexistent' }),
      }, ctx.env);
      expect(res.status).toBe(404);
    });

    it('a private template belonging to another user is invisible and rejected', async () => {
      const created = await (await app.request('/api/content-series/templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u2', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'U2 only' }),
      }, ctx.env)).json() as any;

      globalThis.fetch = mockMinimaxSuccess(3) as any;
      const res = await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'x', requested_count: 3, template_id: created.id }),
      }, ctx.env);
      expect(res.status).toBe(404);
    });

    it('marks the series "partial" (not "completed") when MiniMax returns fewer items than requested, and still charges only real usage', async () => {
      globalThis.fetch = mockMinimaxSuccess(3) as any; // returns 3 items though 5 were requested
      const res = await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'partial test', requested_count: 5 }),
      }, ctx.env);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.series.status).toBe('partial');
      expect(body.series.generated_count).toBe(3);
      expect(body.series.requested_count).toBe(5);
      expect(body.items).toHaveLength(3);

      // credits are still charged on actual token usage, not the requested_count estimate
      const user = ctx.db.prepare("SELECT credits FROM users WHERE id = 'u1'").get() as any;
      expect(user.credits).toBe(99);
      expect(body.series.credits_used).toBe(1);

      // persisted row (not just the response) reflects the partial status
      const stored = ctx.db.prepare("SELECT status, generated_count FROM content_series WHERE id = ?").get(body.series.id) as any;
      expect(stored.status).toBe('partial');
      expect(stored.generated_count).toBe(3);
    });

    it('lists and fetches series history for the requesting user only', async () => {
      globalThis.fetch = mockMinimaxSuccess(2) as any;
      await app.request('/api/content-series', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'A', requested_count: 2 }),
      }, ctx.env);

      const u1List = await (await app.request('/api/content-series', { headers: { Authorization: 'Bearer session-u1' } }, ctx.env)).json() as any;
      expect(u1List.series).toHaveLength(1);

      const u2List = await (await app.request('/api/content-series', { headers: { Authorization: 'Bearer session-u2' } }, ctx.env)).json() as any;
      expect(u2List.series).toHaveLength(0);

      const detail = await (await app.request(`/api/content-series/${u1List.series[0].id}`, { headers: { Authorization: 'Bearer session-u1' } }, ctx.env)).json() as any;
      expect(detail.items).toHaveLength(2);

      const detailAsOtherUser = await app.request(`/api/content-series/${u1List.series[0].id}`, { headers: { Authorization: 'Bearer session-u2' } }, ctx.env);
      expect(detailAsOtherUser.status).toBe(404);
    });
  });
});
