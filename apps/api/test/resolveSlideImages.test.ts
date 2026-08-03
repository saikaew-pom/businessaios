/**
 * Presentation Builder — Stage D Part 2: adversarial coverage for
 * `resolveSlideImages()`, the export-time helper that turns a slide's
 * `media_suggestion.generation_id` into actual image bytes
 * (`resolved_image_base64`/`resolved_image_mime`).
 *
 * The contract under test: this function must NEVER throw — a bad, foreign,
 * incomplete, or malformed generation_id on any one slide must fall back to
 * the original slide (no resolved fields), leaving every other slide's
 * resolution unaffected, and must never leak another user's image bytes.
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import { createCsrfToken } from '../src/lib/middleware';
import { resolveSlideImages } from '../src/presentationRoutes';
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
    async put(key: string, value: string | ArrayBuffer | Uint8Array, options?: any) {
      const bytes = typeof value === 'string'
        ? new TextEncoder().encode(value)
        : value instanceof Uint8Array ? value : new Uint8Array(value);
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        async arrayBuffer() {
          return object.bytes.buffer.slice(
            object.bytes.byteOffset,
            object.bytes.byteOffset + object.bytes.byteLength,
          );
        },
        size: object.bytes.byteLength,
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
    objects,
  };
}

function makeEnv() {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db);
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, created_at, updated_at)
    VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, created_at, updated_at)
    VALUES ('u2', 'u2@test.com', 'x', 'User Two', 'free', 0, 0);
    INSERT INTO ai_models (
      id, provider, provider_model_id, display_name, model_type, operation,
      capabilities_json, pricing_json, pricing_version, created_at, updated_at
    ) VALUES ('model-x', 'minimax', 'model-x', 'Test Model', 'image', 'text_to_image', '{}', '{}', 'v1', 0, 0);
    INSERT INTO media_pricing_quotes (
      id, user_id, model_id, request_hash, pricing_version, credits, pricing_snapshot_json, expires_at, created_at
    ) VALUES ('quote-u1', 'u1', 'model-x', 'hash-x', 'v1', 2, '{}', ${Date.now() + 60_000}, 0);
    INSERT INTO media_pricing_quotes (
      id, user_id, model_id, request_hash, pricing_version, credits, pricing_snapshot_json, expires_at, created_at
    ) VALUES ('quote-u2', 'u2', 'model-x', 'hash-x', 'v1', 2, '{}', ${Date.now() + 60_000}, 0);
  `);
  return { db, env: { DB: makeD1Shim(db), R2: makeR2Mock() } as any };
}

// Foreign keys ARE enforced under node:sqlite in this test harness, so
// generations need a real ai_models row and a real media_pricing_quotes row
// to satisfy them — seeded once per user in makeEnv() above ('model-x' /
// 'quote-u1' / 'quote-u2'). Everything else is the minimal set of columns
// resolveSlideImages/getGeneration/media_assets actually read.
function insertGeneration(db: DatabaseSync, opts: { id: string; userId: string; status: string }) {
  db.prepare(`
    INSERT INTO media_generations (
      id, user_id, model_id, client_idempotency_key, request_hash, quote_id,
      operation, prompt, options_json, status, submission_state, delivery_status,
      estimated_credits, pricing_version, pricing_snapshot_json,
      expected_output_count, delivered_output_count, created_at, updated_at
    ) VALUES (?, ?, 'model-x', ?, 'hash-x', ?, 'text_to_image', 'a cat', '{}', ?, 'submitted', 'available', 2, 'v1', '{}', 1, 1, 0, 0)
  `).run(opts.id, opts.userId, `idem-${opts.id}`, `quote-${opts.userId}`, opts.status);
}

function insertAsset(db: DatabaseSync, opts: { id: string; userId: string; generationId: string; r2Key: string; mimeType?: string; lifecycleStatus?: string }) {
  db.prepare(`
    INSERT INTO media_assets (
      id, user_id, generation_id, asset_type, source, r2_key, mime_type,
      file_size, lifecycle_status, created_at, updated_at
    ) VALUES (?, ?, ?, 'image', 'generation', ?, ?, 100, ?, 0, 0)
  `).run(opts.id, opts.userId, opts.generationId, opts.r2Key, opts.mimeType || 'image/png', opts.lifecycleStatus || 'active');
}

function slideWithGenerationId(slideNumber: number, generationId: string | undefined) {
  return {
    slide_number: slideNumber,
    title: `Slide ${slideNumber}`,
    media_suggestion: generationId
      ? { kind: 'image', description: 'a cat', image_prompt: 'a cat', generation_id: generationId }
      : { kind: 'image', description: 'a cat', image_prompt: 'a cat' },
  };
}

describe('resolveSlideImages — adversarial generation_id handling', () => {
  let ctx: ReturnType<typeof makeEnv>;
  beforeEach(() => { ctx = makeEnv(); });

  it('passes through a blueprint with no slides untouched', async () => {
    const result = await resolveSlideImages(ctx.env, 'u1', {});
    expect(result).toEqual({});
    const result2 = await resolveSlideImages(ctx.env, 'u1', { slides: [] });
    expect(result2).toEqual({ slides: [] });
  });

  it('leaves a slide with no generation_id completely unchanged', async () => {
    const blueprint = { slides: [slideWithGenerationId(1, undefined)] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides[0]).toEqual(blueprint.slides[0]);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
  });

  it('does not throw and falls back for a nonexistent generation_id', async () => {
    const blueprint = { slides: [slideWithGenerationId(1, 'gen-does-not-exist')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
    expect(result.slides[0].title).toBe('Slide 1');
  });

  it('does not throw and does not leak another user\'s completed generation image', async () => {
    insertGeneration(ctx.db, { id: 'gen-u2', userId: 'u2', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-u2', userId: 'u2', generationId: 'gen-u2', r2Key: 'media/u2/outputs/gen-u2/asset-u2.png' });
    await ctx.env.R2.put('media/u2/outputs/gen-u2/asset-u2.png', new Uint8Array([1, 2, 3]));

    // u1 attempts to export a slide referencing u2's generation (e.g. a
    // crafted onSave payload) — getGeneration's own user_id filter must
    // reject this before the asset lookup is ever reached.
    const blueprint = { slides: [slideWithGenerationId(1, 'gen-u2')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
  });

  it.each(['queued', 'submitting', 'processing', 'delivery_pending', 'failed', 'cancelled', 'cancel_requested'])(
    'falls back without throwing when the generation status is %s (not completed)',
    async (status) => {
      insertGeneration(ctx.db, { id: `gen-${status}`, userId: 'u1', status });
      const blueprint = { slides: [slideWithGenerationId(1, `gen-${status}`)] };
      const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
      expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
    },
  );

  it('falls back without throwing when the generation is completed but has no active asset row', async () => {
    insertGeneration(ctx.db, { id: 'gen-no-asset', userId: 'u1', status: 'completed' });
    const blueprint = { slides: [slideWithGenerationId(1, 'gen-no-asset')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
  });

  it('falls back without throwing when the only asset row is archived/purged (not active)', async () => {
    insertGeneration(ctx.db, { id: 'gen-archived', userId: 'u1', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-archived', userId: 'u1', generationId: 'gen-archived', r2Key: 'media/u1/outputs/gen-archived/a.png', lifecycleStatus: 'archived' });
    const blueprint = { slides: [slideWithGenerationId(1, 'gen-archived')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
  });

  it('falls back without throwing when the DB row is active but the R2 object is missing', async () => {
    insertGeneration(ctx.db, { id: 'gen-missing-r2', userId: 'u1', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-missing-r2', userId: 'u1', generationId: 'gen-missing-r2', r2Key: 'media/u1/outputs/gen-missing-r2/gone.png' });
    // Deliberately never put the object in R2 — simulates a deleted/expired object.
    const blueprint = { slides: [slideWithGenerationId(1, 'gen-missing-r2')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
  });

  it.each([null, '', 42, {}, ['x']])(
    'treats a malformed generation_id (%p) as absent rather than throwing',
    async (badValue) => {
      const blueprint = { slides: [{ slide_number: 1, title: 'Slide 1', media_suggestion: { kind: 'image', generation_id: badValue } }] };
      const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
      expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
    },
  );

  it('resolves real image bytes for a completed, same-user generation and round-trips them correctly', async () => {
    insertGeneration(ctx.db, { id: 'gen-ok', userId: 'u1', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-ok', userId: 'u1', generationId: 'gen-ok', r2Key: 'media/u1/outputs/gen-ok/ok.png', mimeType: 'image/png' });
    const originalBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5]);
    await ctx.env.R2.put('media/u1/outputs/gen-ok/ok.png', originalBytes);

    const blueprint = { slides: [slideWithGenerationId(1, 'gen-ok')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    const resolved = result.slides[0].media_suggestion;
    expect(resolved.resolved_image_mime).toBe('image/png');
    expect(resolved.resolved_image_base64).toBeTruthy();
    expect(new Uint8Array(Buffer.from(resolved.resolved_image_base64, 'base64'))).toEqual(originalBytes);
    // Original fields (generation_id, description, image_prompt) survive the merge.
    expect(resolved.generation_id).toBe('gen-ok');
    expect(resolved.image_prompt).toBe('a cat');
  });

  it('correctly base64-encodes a large image spanning multiple chunk-loop iterations (>8192 bytes)', async () => {
    insertGeneration(ctx.db, { id: 'gen-big', userId: 'u1', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-big', userId: 'u1', generationId: 'gen-big', r2Key: 'media/u1/outputs/gen-big/big.png' });
    const bigBytes = new Uint8Array(20000);
    for (let i = 0; i < bigBytes.length; i++) bigBytes[i] = i % 256;
    await ctx.env.R2.put('media/u1/outputs/gen-big/big.png', bigBytes);

    const blueprint = { slides: [slideWithGenerationId(1, 'gen-big')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    const decoded = new Uint8Array(Buffer.from(result.slides[0].media_suggestion.resolved_image_base64, 'base64'));
    expect(decoded).toEqual(bigBytes);
  });

  it('defense-in-depth: does not attach an asset whose user_id mismatches even if generation_id somehow matched (data-integrity guard)', async () => {
    // getGeneration() already scopes by user_id, so this asset-level
    // mismatch cannot occur via the app's own generation pipeline today
    // (processor.ts always writes generation.user_id onto its output
    // assets) — but the extra check in resolveSlideImages is a real,
    // functioning guard, not dead code: construct the data-integrity
    // violation directly and confirm it actually fires.
    insertGeneration(ctx.db, { id: 'gen-mismatch', userId: 'u1', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-mismatch', userId: 'u2', generationId: 'gen-mismatch', r2Key: 'media/u2/outputs/gen-mismatch/x.png' });
    await ctx.env.R2.put('media/u2/outputs/gen-mismatch/x.png', new Uint8Array([9, 9, 9]));

    const blueprint = { slides: [slideWithGenerationId(1, 'gen-mismatch')] };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
  });

  it('resolves independently per slide — one bad slide does not affect a good sibling slide, and order is preserved', async () => {
    insertGeneration(ctx.db, { id: 'gen-good', userId: 'u1', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-good', userId: 'u1', generationId: 'gen-good', r2Key: 'media/u1/outputs/gen-good/g.png' });
    await ctx.env.R2.put('media/u1/outputs/gen-good/g.png', new Uint8Array([1, 1, 1]));

    const blueprint = {
      slides: [
        slideWithGenerationId(1, 'gen-does-not-exist'),
        slideWithGenerationId(2, 'gen-good'),
        slideWithGenerationId(3, undefined),
      ],
    };
    const result = await resolveSlideImages(ctx.env, 'u1', blueprint);
    expect(result.slides.map((s: any) => s.slide_number)).toEqual([1, 2, 3]);
    expect(result.slides[0].media_suggestion.resolved_image_base64).toBeUndefined();
    expect(result.slides[1].media_suggestion.resolved_image_base64).toBeTruthy();
    expect(result.slides[2].media_suggestion.resolved_image_base64).toBeUndefined();
  });
});

describe('resolveSlideImages — wired into the real POST /export route (end-to-end, not just the unit function)', () => {
  it('exports successfully (200, not 500) when Step 7 references a foreign/cross-user generation_id', async () => {
    const ctx = makeEnv();
    const userColumns = (ctx.db.prepare('PRAGMA table_info(users)').all() as any[]).map((c: any) => c.name);
    if (!userColumns.includes('credits')) ctx.db.exec('ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100');
    if (!userColumns.includes('role')) ctx.db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    if (!userColumns.includes('email_verified')) ctx.db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1');
    ctx.db.exec(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ('session-u1', 'u1', ${Date.now() + 60_000}, 0);`);
    ctx.env.ALLOWED_ORIGIN = 'http://localhost:5173';

    // u2's completed generation — u1 will try to export a slide that
    // references it, as a crafted onSave payload might.
    insertGeneration(ctx.db, { id: 'gen-foreign', userId: 'u2', status: 'completed' });
    insertAsset(ctx.db, { id: 'asset-foreign', userId: 'u2', generationId: 'gen-foreign', r2Key: 'media/u2/outputs/gen-foreign/x.png' });
    await ctx.env.R2.put('media/u2/outputs/gen-foreign/x.png', new Uint8Array([1, 2, 3]));

    const projectId = 'proj-1';
    ctx.db.exec(`
      INSERT INTO presentation_projects (id, user_id, title, objective, framework_variant, target_slides, time_minutes, language, color_theme, status, current_step, created_at, updated_at)
      VALUES ('${projectId}', 'u1', 'Test', 'informative', 'scqa_minto', 10, 15, 'th', 'business_blue', 'draft', 7, 0, 0);
    `);
    const outline = { framework: 'scqa_minto', outline: [{ slide_number: 1, title: 'Intro', section: 's' }] };
    const blueprint = { slides: [slideWithGenerationId(1, 'gen-foreign')] };
    ctx.db.prepare(`
      INSERT INTO presentation_steps (id, project_id, step_number, output_json, status, created_at, updated_at)
      VALUES (?, ?, 6, ?, 'done', 0, 0)
    `).run('step6', projectId, JSON.stringify(outline));
    ctx.db.prepare(`
      INSERT INTO presentation_steps (id, project_id, step_number, output_json, status, created_at, updated_at)
      VALUES (?, ?, 7, ?, 'done', 0, 0)
    `).run('step7', projectId, JSON.stringify(blueprint));

    const csrf = await createCsrfToken(ctx.env, 'session-u1');
    const res = await app.request(`/api/presentation/projects/${projectId}/export`, {
      method: 'POST',
      headers: { Cookie: 'session=session-u1', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'html' }),
    }, ctx.env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
  });
});
