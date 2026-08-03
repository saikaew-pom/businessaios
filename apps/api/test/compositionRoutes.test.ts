/**
 * Visual Templates + composition rendering — HTTP-route-driven tests
 * against the real D1 shim + full migration chain + a real renderer call
 * (satori + resvg-wasm, not mocked), same rigor as contentSeries.test.ts.
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

function makeR2Mock() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  return {
    async put(key: string, value: any, options?: any) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        arrayBuffer: async () => object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength),
        size: object.bytes.byteLength,
      };
    },
    objects,
  };
}

function pngBytes(): Uint8Array {
  return new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4kWKEFTEMLQkAVkZXgTy9n4kAAAAASUVORK5CYII=', 'base64'));
}

function makeEnv(opts: { enabled?: boolean; quotaMb?: number } = {}) {
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
    INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
    VALUES ('admin1', 'admin@test.com', 'x', 'Admin One', 'free', 'admin', 100, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u2', 'u2', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-admin', 'admin1', ${Date.now() + 60_000}, 0);
  `);
  const r2 = makeR2Mock();
  return {
    db,
    r2,
    env: {
      DB: makeD1Shim(db),
      R2: r2,
      ALLOWED_ORIGIN: 'http://localhost:5173',
      API_URL: 'https://api.test',
      MASTER_ENCRYPTION_KEY: 'test-master-encryption-key',
      CREATIVE_STUDIO_ENABLED: 'true',
      BRAND_COMPOSITION_ENABLED: opts.enabled === false ? 'false' : 'true',
      MEDIA_STORAGE_QUOTA_MB: opts.quotaMb !== undefined ? String(opts.quotaMb) : '1000',
    } as any,
  };
}

function seedAsset(db: DatabaseSync, r2: ReturnType<typeof makeR2Mock>, opts: { id: string; userId: string }) {
  const bytes = pngBytes();
  const r2Key = `media/${opts.userId}/inputs/${opts.id}/original.png`;
  r2.objects.set(r2Key, { bytes, contentType: 'image/png' });
  db.exec(`
    INSERT INTO media_assets (
      id, user_id, asset_type, source, r2_key, original_filename, mime_type,
      file_size, width, height, metadata_json, lifecycle_status, created_at, updated_at
    )
    VALUES (
      '${opts.id}', '${opts.userId}', 'image', 'upload', '${r2Key}',
      'asset.png', 'image/png', ${bytes.byteLength}, 8, 8, '{}', 'active', 0, 0
    );
  `);
}

const BOTTOM_GRADIENT_LAYOUT = {
  canvas: { width: 1080, height: 1080 },
  background: { overlay_gradient: { direction: '180deg', stops: [{ offset: '45%', color: 'rgba(0,0,0,0)' }, { offset: '100%', color: 'rgba(0,0,0,0.82)' }] } },
  blocks: [{ type: 'headline', anchor: 'bottom-left', font_size: 58, font_weight: 700, color: '#ffffff' }],
};

describe('Visual Templates + composition rendering', () => {
  let ctx: ReturnType<typeof makeEnv>;

  describe('feature gate', () => {
    it('404s when BRAND_COMPOSITION_ENABLED is off', async () => {
      ctx = makeEnv({ enabled: false });
      const res = await app.request('/api/visual-templates', { headers: { Authorization: 'Bearer session-u1' } }, ctx.env);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: 'feature_disabled' });
    });
  });

  describe('template visibility split', () => {
    beforeEach(() => { ctx = makeEnv(); });

    it('lets a regular user create only a private template, never a global one', async () => {
      const forbidden = await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sneaky Global', layout: BOTTOM_GRADIENT_LAYOUT, owner_type: 'admin' }),
      }, ctx.env);
      expect(forbidden.status).toBe(403);

      const created = await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Private Template', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env);
      expect(created.status).toBe(201);
      expect((await created.json() as any).owner_type).toBe('user');
    });

    it('rejects a malformed layout', async () => {
      const res = await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bad', layout: { canvas: { width: 1080 } } }),
      }, ctx.env);
      expect(res.status).toBe(400);
    });

    it('shows admin-global templates to every user, but private templates only to their owner', async () => {
      await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Global Template', layout: BOTTOM_GRADIENT_LAYOUT, owner_type: 'admin' }),
      }, ctx.env);
      await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'U1 Private', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env);

      // The migration seeds 5 built-in admin templates — visible to
      // everyone alongside whatever's created in this test, hence
      // `toContain` rather than a fixed-length equality here.
      const u1List = await (await app.request('/api/visual-templates', { headers: { Authorization: 'Bearer session-u1' } }, ctx.env)).json() as any;
      const u1Names = u1List.templates.map((t: any) => t.name);
      expect(u1Names).toContain('Global Template');
      expect(u1Names).toContain('U1 Private');

      const u2List = await (await app.request('/api/visual-templates', { headers: { Authorization: 'Bearer session-u2' } }, ctx.env)).json() as any;
      const u2Names = u2List.templates.map((t: any) => t.name);
      expect(u2Names).toContain('Global Template');
      expect(u2Names).not.toContain('U1 Private');
    });

    it('blocks deleting a template you neither own nor administer, drops it from listings once deleted', async () => {
      const created = await (await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'U1 Template', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env)).json() as any;

      const deleteByOther = await app.request(`/api/visual-templates/${created.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer session-u2' } }, ctx.env);
      expect(deleteByOther.status).toBe(403);

      const deleteByOwner = await app.request(`/api/visual-templates/${created.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer session-u1' } }, ctx.env);
      expect(deleteByOwner.status).toBe(200);

      const list = await (await app.request('/api/visual-templates', { headers: { Authorization: 'Bearer session-u1' } }, ctx.env)).json() as any;
      expect(list.templates.map((t: any) => t.id)).not.toContain(created.id);
    });
  });

  describe('composition rendering', () => {
    beforeEach(() => { ctx = makeEnv(); });

    it('renders a template onto an existing asset and produces a new derived asset + composition record', async () => {
      seedAsset(ctx.db, ctx.r2, { id: 'asset-1', userId: 'u1' });
      const template = await (await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bottom Gradient', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env)).json() as any;

      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-1', template_id: template.id, headline: 'ทดสอบ headline ภาษาไทย' }),
      }, ctx.env);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.asset.mime_type).toBe('image/png');
      expect(body.asset.width).toBe(1080);

      const composition = ctx.db.prepare('SELECT * FROM composition_documents WHERE id = ?').get(body.composition_id) as any;
      expect(composition.status).toBe('rendered');
      expect(composition.exported_asset_id).toBe(body.asset.id);
      expect(composition.base_asset_id).toBe('asset-1');
    });

    it('rejects when no text field is provided at all', async () => {
      seedAsset(ctx.db, ctx.r2, { id: 'asset-1', userId: 'u1' });
      const template = await (await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bottom Gradient', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env)).json() as any;

      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-1', template_id: template.id }),
      }, ctx.env);
      expect(res.status).toBe(400);
    });

    it("rejects rendering onto another user's asset", async () => {
      seedAsset(ctx.db, ctx.r2, { id: 'asset-u2', userId: 'u2' });
      const template = await (await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bottom Gradient', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env)).json() as any;

      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-u2', template_id: template.id, headline: 'x' }),
      }, ctx.env);
      expect(res.status).toBe(404);
    });

    it('rejects an unknown or invisible template_id', async () => {
      seedAsset(ctx.db, ctx.r2, { id: 'asset-1', userId: 'u1' });
      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-1', template_id: 'nonexistent', headline: 'x' }),
      }, ctx.env);
      expect(res.status).toBe(404);
    });

    it('a private template belonging to another user is invisible and rejected', async () => {
      seedAsset(ctx.db, ctx.r2, { id: 'asset-1', userId: 'u1' });
      const u2Template = await (await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u2', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'U2 only', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env)).json() as any;

      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-1', template_id: u2Template.id, headline: 'x' }),
      }, ctx.env);
      expect(res.status).toBe(404);
    });

    it('rejects when the storage quota would be exceeded, without touching R2 or the DB', async () => {
      ctx = makeEnv({ quotaMb: 0.00001 }); // ~10 bytes — smaller than the seeded fixture
      seedAsset(ctx.db, ctx.r2, { id: 'asset-1', userId: 'u1' });
      const template = await (await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bottom Gradient', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env)).json() as any;

      const assetCountBefore = (ctx.db.prepare('SELECT COUNT(*) as n FROM media_assets').get() as any).n;
      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-1', template_id: template.id, headline: 'x' }),
      }, ctx.env);
      expect(res.status).toBe(413);
      const assetCountAfter = (ctx.db.prepare('SELECT COUNT(*) as n FROM media_assets').get() as any).n;
      expect(assetCountAfter).toBe(assetCountBefore);
    });

    it('returns a controlled render_failed response (not a raw-message-leaking 500) when the stored layout is malformed', async () => {
      // Regression test: a template row with an unknown anchor value (e.g. a
      // legacy row from before anchor validation existed, or hand-edited
      // data) used to crash `buildInnerNode` with an uncaught
      // "Cannot read properties of undefined (reading 'textAlign')"
      // TypeError. Because `parseTemplateLayout` was called OUTSIDE the
      // route's try/catch, that error skipped the route's own `render_failed`
      // handling entirely and fell through to the app-wide `onError` handler
      // instead, which returns `{ error: 'internal_error', message: <raw
      // exception text> }` — a 500 with implementation detail leaking into
      // `message`, on a code path the frontend's humanizeError() doesn't
      // even have a translation for (it only maps `render_failed`).
      seedAsset(ctx.db, ctx.r2, { id: 'asset-1', userId: 'u1' });
      const now = Date.now();
      const badLayoutJson = JSON.stringify({
        canvas: { width: 1080, height: 1080 },
        blocks: [{ type: 'headline', anchor: 'bogus-anchor', font_size: 48, color: '#fff' }],
      });
      ctx.db.prepare(`
        INSERT INTO visual_templates (id, owner_type, owner_user_id, name, description, layout_json, is_active, created_at, updated_at)
        VALUES ('bad-template', 'user', 'u1', 'Malformed', '', ?, 1, ?, ?)
      `).run(badLayoutJson, now, now);

      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-1', template_id: 'bad-template', headline: 'x' }),
      }, ctx.env);
      const responseBody = await res.json() as any;

      expect(res.status).toBe(422);
      expect(responseBody.error).toBe('render_failed');
      // The raw exception text must not be surfaced under `message` — that's
      // the exact field fetchAPI() on the frontend prefers over `error` when
      // unwrapping a failed response, which is what made the friendly
      // humanizeError() translation for `render_failed` unreachable.
      expect(responseBody.message).toBeUndefined();
    });

    it('rejects based on the actual rendered PNG size, not the (much smaller) source asset size', async () => {
      // Regression test: the quota check used to pass `sourceAsset.file_size`
      // (the size of the EXISTING source image) to checkStorageQuota, not
      // the size of the NEW derived PNG this call is about to write. The
      // tiny seeded fixture here is 74 bytes, but rendering this layout
      // actually produces an ~8.6KB PNG — a quota set between those two
      // numbers must reject, because the real write would blow the quota
      // even though the source asset alone would not.
      ctx = makeEnv({ quotaMb: 0.002 }); // ~2097 bytes: > 74-byte source, < ~8.6KB composed PNG
      seedAsset(ctx.db, ctx.r2, { id: 'asset-1', userId: 'u1' });
      const template = await (await app.request('/api/visual-templates', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bottom Gradient', layout: BOTTOM_GRADIENT_LAYOUT }),
      }, ctx.env)).json() as any;

      const assetCountBefore = (ctx.db.prepare('SELECT COUNT(*) as n FROM media_assets').get() as any).n;
      const res = await app.request('/api/compositions/render', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-u1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_asset_id: 'asset-1', template_id: template.id, headline: 'x' }),
      }, ctx.env);
      expect(res.status).toBe(413);
      const assetCountAfter = (ctx.db.prepare('SELECT COUNT(*) as n FROM media_assets').get() as any).n;
      expect(assetCountAfter).toBe(assetCountBefore);
    });
  });
});
