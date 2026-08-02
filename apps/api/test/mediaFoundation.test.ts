import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import { createBrandContextSnapshot, createBrandProfile } from '../src/lib/creative/brandContext';
import { createPricingQuote, getModelById, listActiveMediaModels } from '../src/lib/media/catalog';
import { runMediaProcessor } from '../src/lib/media/processor';
import { parsePromptMentions, validateReferencesForModel } from '../src/lib/media/referenceResolver';
import { claimMediaWorkItems, enqueueMediaWorkItem } from '../src/lib/media/workItems';
import { reconcileStuckGenerations } from '../src/lib/media/reconciler';
import { sweepMediaPurge } from '../src/lib/media/purge';
import { makeD1Shim } from './helpers/d1-shim';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

function applyMigrations(db: DatabaseSync) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const file of files) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
}

function makeEnv(flags: { creative?: boolean; brand?: boolean } = {}) {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db);
  const userColumns = (db.prepare('PRAGMA table_info(users)').all() as any[]).map((column) => column.name);
  if (!userColumns.includes('credits')) db.exec('ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100');
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, plan, credits, created_at, updated_at)
    VALUES ('u1', 'u1@test.com', 'x', 'User One', 'free', 100, 0, 0);
    INSERT INTO users (id, email, password_hash, name, plan, credits, created_at, updated_at)
    VALUES ('u2', 'u2@test.com', 'x', 'User Two', 'free', 100, 0, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES ('session-1', 'u1', ${Date.now() + 60_000}, 0);
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES ('session-2', 'u2', ${Date.now() + 60_000}, 0);
  `);
  return {
    db,
    env: {
      DB: makeD1Shim(db),
      R2: makeR2Mock(),
      ALLOWED_ORIGIN: 'http://localhost:5173',
      RESEND_FROM_EMAIL: 'test@example.com',
      NOTIFY_EMAIL: 'test@example.com',
      MINIMAX_MODEL: 'MiniMax-M3',
      MINIMAX_API_KEY: 'test-key',
      MINIMAX_GROUP_ID: 'test-group',
      MEDIA_SIGNING_SECRET: 'test-media-signing-secret',
      MASTER_ENCRYPTION_KEY: 'test-master-encryption-key',
      API_URL: 'https://api.test',
      CREATIVE_STUDIO_ENABLED: flags.creative ? 'true' : 'false',
      BRAND_CONTEXT_ENABLED: flags.brand ? 'true' : 'false',
      BRAND_COMPOSITION_ENABLED: flags.brand ? 'true' : 'false',
    } as any,
  };
}

function pngBase64(width = 32, height = 24) {
  return Buffer.from(pngBytes(width, height)).toString('base64');
}

// `pngBytes()` above is header-only (signature + IHDR, no IDAT/IEND) — enough
// for inspectImageBytes()'s magic-byte/dimension check, but not a real,
// decodable PNG. Thumbnail generation runs a real Photon (WASM) decode, so
// it needs an actual valid 8x8 RGB PNG — this constant is one.
const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4kWKEFTEMLQkAVkZXgTy9n4kAAAAASUVORK5CYII=';
function validPngBytes(): Uint8Array {
  return new Uint8Array(Buffer.from(VALID_PNG_BASE64, 'base64'));
}

function makeR2Mock() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  return {
    async put(key: string, value: string | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>, options?: any) {
      const bytes = typeof value === 'string'
        ? new TextEncoder().encode(value)
        : value instanceof ReadableStream
        ? new Uint8Array(await new Response(value).arrayBuffer())
        : value instanceof Uint8Array ? value : new Uint8Array(value);
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(object.bytes);
            controller.close();
          },
        }),
        async arrayBuffer() {
          return object.bytes.buffer.slice(
            object.bytes.byteOffset,
            object.bytes.byteOffset + object.bytes.byteLength,
          );
        },
        async text() {
          return new TextDecoder().decode(object.bytes);
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

function pngBytes(width = 32, height = 24) {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x08, 0x06, 0x00, 0x00, 0x00,
  ]);
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

describe('Creative Studio Phase 1 foundation', () => {
  let ctx: ReturnType<typeof makeEnv>;

  beforeEach(() => {
    ctx = makeEnv({ creative: true, brand: true });
  });

  it('seeds and lists active media models with runtime-validated config', async () => {
    const models = await listActiveMediaModels(ctx.env);
    expect(models.map((model) => model.id)).toEqual([
      'minimax-image-01-t2i',
      'minimax-image-01-i2i-subject',
    ]);
    expect(models[1].capabilities).toMatchObject({
      references: {
        providerTypes: ['character'],
        disabledProviderTypes: ['product'],
      },
    });
  });

  it('creates pricing quotes with stable request hashes and capability checks', async () => {
    const quote = await createPricingQuote(ctx.env, 'u1', {
      model_id: 'minimax-image-01-t2i',
      options: { aspect_ratio: '1:1', num_images: 2, response_format: 'url' },
      reference_count: 0,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    expect(quote.quote).toMatchObject({
      credits: 4,
      pricing_version: 'minimax-image-01-2026-08-01-beta-v1',
    });
    const sameBillableQuote = await createPricingQuote(ctx.env, 'u1', {
      model_id: 'minimax-image-01-t2i',
      options: { aspect_ratio: '1:1', num_images: 2, response_format: 'url', prompt_optimizer: true },
      reference_count: 0,
    });
    expect(sameBillableQuote.ok).toBe(true);
    if (!sameBillableQuote.ok) return;
    expect(sameBillableQuote.quote.request_hash).toBe(quote.quote.request_hash);

    const bad = await createPricingQuote(ctx.env, 'u1', {
      model_id: 'minimax-image-01-t2i',
      options: { aspect_ratio: '5:7', num_images: 1 },
    });
    expect(bad).toMatchObject({ ok: false, error: 'aspect_ratio_not_supported' });
  });

  it('captures immutable brand context snapshots', async () => {
    const created = await createBrandProfile(ctx.env, 'u1', {
      name: 'SME AI Coach',
      business_summary: 'AI coaching for Thai SME owners',
      audience: [{ segment: 'SME owners' }],
      tone_of_voice: ['clear', 'practical'],
      content_pillars: ['automation', 'sales'],
      offers: [{ name: 'AI workshop' }],
      rules: { avoid: ['jargon'] },
      is_default: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const first = await createBrandContextSnapshot(ctx.env, 'u1', created.profile.id, 100);
    ctx.db.exec(`UPDATE brand_profiles SET business_summary = 'Changed later', updated_at = 200 WHERE id = '${created.profile.id}'`);
    const second = await createBrandContextSnapshot(ctx.env, 'u1', created.profile.id, 300);

    expect(first.snapshot).toMatchObject({ business_summary: 'AI coaching for Thai SME owners' });
    expect(second.snapshot).toMatchObject({ business_summary: 'Changed later' });
    expect(first.snapshot_hash).not.toEqual(second.snapshot_hash);
  });

  it('claims expired work-item leases without duplicating dedupe keys', async () => {
    await enqueueMediaWorkItem(ctx.env, {
      work_type: 'submit_generation',
      dedupe_key: 'submit:generation-1',
      payload: { generation_id: 'generation-1' },
    }, 100);
    await enqueueMediaWorkItem(ctx.env, {
      work_type: 'submit_generation',
      dedupe_key: 'submit:generation-1',
      payload: { ignored: true },
    }, 200);

    const firstClaim = await claimMediaWorkItems(ctx.env, { leaseMs: 50 }, 300);
    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0].attempts).toBe(1);

    const secondClaimBeforeExpiry = await claimMediaWorkItems(ctx.env, { leaseMs: 50 }, 320);
    expect(secondClaimBeforeExpiry).toHaveLength(0);

    const secondClaimAfterExpiry = await claimMediaWorkItems(ctx.env, { leaseMs: 50 }, 360);
    expect(secondClaimAfterExpiry).toHaveLength(1);
    expect(secondClaimAfterExpiry[0].attempts).toBe(2);
  });
});

describe('Creative Studio feature gates', () => {
  it('blocks media routes while the feature flag is off', async () => {
    const { env } = makeEnv({ creative: false, brand: true });
    const res = await app.request('/api/media/models', {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'feature_disabled' });
  });

  it('serves catalog and brand endpoints when flags are on', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    const models = await app.request('/api/media/models', {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(models.status).toBe(200);
    expect((await models.json() as any).models).toHaveLength(2);

    const created = await app.request('/api/brand-profiles', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Brand', audience: [], tone_of_voice: [], content_pillars: [], offers: [], rules: {} }),
    }, env);
    expect(created.status).toBe(201);
  });
});

describe('Brand Kit lifecycle', () => {
  it('creates, defaults, archives, restores, and deletes a brand kit', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    const created = await app.request('/api/brand-kits', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'SME AI Coach',
        colors: [{ role: 'primary', value: '#08152f' }],
        typography: { heading: 'Prompt', body: 'Sarabun' },
        rules: { brandbook: { language: { default: 'th' } } },
        default_language: 'th',
        is_default: true,
      }),
    }, env);
    expect(created.status).toBe(200);
    const kit = (await created.json() as any).brand_kit;
    expect(kit).toMatchObject({
      name: 'SME AI Coach',
      lifecycle_status: 'active',
      default_language: 'th',
      is_default: true,
    });

    const exportRes = await app.request(`/api/brand-kits/${kit.id}/export/pdf`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language: 'th' }),
    }, env);
    expect(exportRes.status).toBe(200);
    const exported = await exportRes.json() as any;
    expect(exported.download_url).toContain(`/api/brand-kits/${kit.id}/exports/`);

    const exportDoc = await app.request(exported.download_url, {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(exportDoc.status).toBe(200);
    expect(await exportDoc.text()).toContain('SME AI Coach');

    const archived = await app.request(`/api/brand-kits/${kit.id}/archive`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(archived.status).toBe(200);
    expect((await archived.json() as any).brand_kit).toMatchObject({
      lifecycle_status: 'archived',
      is_default: false,
    });

    const activeList = await app.request('/api/brand-kits', {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect((await activeList.json() as any).brand_kits).toHaveLength(0);

    const archivedList = await app.request('/api/brand-kits?status=archived', {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect((await archivedList.json() as any).brand_kits).toHaveLength(1);

    const restored = await app.request(`/api/brand-kits/${kit.id}/restore`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(restored.status).toBe(200);
    expect((await restored.json() as any).brand_kit.lifecycle_status).toBe('active');

    const madeDefault = await app.request(`/api/brand-kits/${kit.id}/default`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(madeDefault.status).toBe(200);
    expect((await madeDefault.json() as any).brand_kit.is_default).toBe(true);

    const deleted = await app.request(`/api/brand-kits/${kit.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(deleted.status).toBe(200);

    const detail = await app.request(`/api/brand-kits/${kit.id}`, {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(detail.status).toBe(404);
  });
});

describe('Creative Studio Phase 2 asset pipeline', () => {
  it('uploads, finalizes, lists, serves, and signs an image asset', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    const bytes = pngBytes();

    const intentRes = await app.request('/api/media/assets/upload-intents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: '../workshop.png',
        mime_type: 'image/png',
        file_size: bytes.byteLength,
        asset_type: 'image',
      }),
    }, env);
    expect(intentRes.status).toBe(201);
    const intent = await intentRes.json() as any;
    expect(intent).toMatchObject({ max_bytes: 10 * 1024 * 1024 });

    const uploadRes = await app.request(intent.upload_url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-1',
        'X-Upload-Token': intent.upload_token,
        'Content-Type': 'image/png',
        'Content-Length': String(bytes.byteLength),
      },
      body: bytes,
    }, env);
    expect(uploadRes.status).toBe(200);

    const reuseRes = await app.request(intent.upload_url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-1',
        'X-Upload-Token': intent.upload_token,
        'Content-Type': 'image/png',
        'Content-Length': String(bytes.byteLength),
      },
      body: bytes,
    }, env);
    expect(reuseRes.status).toBe(409);

    const finalizeRes = await app.request(`/api/media/assets/${intent.asset_id}/finalize-upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(finalizeRes.status).toBe(200);
    const asset = await finalizeRes.json() as any;
    expect(asset).toMatchObject({
      id: intent.asset_id,
      mime_type: 'image/png',
      width: 32,
      height: 24,
      lifecycle_status: 'active',
    });
    expect(asset.metadata.inspection.metadata_stripped).toBe(false);

    const listRes = await app.request('/api/media/assets', {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(listRes.status).toBe(200);
    expect((await listRes.json() as any).assets).toHaveLength(1);

    const detailRes = await app.request(`/api/media/assets/${intent.asset_id}`, {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json() as any;
    expect(detail.provider_url).toContain(`/api/media/provider-assets/${intent.asset_id}`);

    const contentRes = await app.request(`/api/media/assets/${intent.asset_id}/content`, {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(contentRes.status).toBe(200);
    expect(contentRes.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await contentRes.arrayBuffer())).toEqual(bytes);

    const providerRes = await app.request(detail.provider_url, {}, env);
    expect(providerRes.status).toBe(200);
    expect(new Uint8Array(await providerRes.arrayBuffer())).toEqual(bytes);
  });

  it('rejects cross-user access and invalid media bytes', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    const badBytes = new Uint8Array([1, 2, 3, 4]);

    const intentRes = await app.request('/api/media/assets/upload-intents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'not-image.png',
        mime_type: 'image/png',
        file_size: badBytes.byteLength,
      }),
    }, env);
    const intent = await intentRes.json() as any;

    await app.request(intent.upload_url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-1',
        'X-Upload-Token': intent.upload_token,
        'Content-Type': 'image/png',
        'Content-Length': String(badBytes.byteLength),
      },
      body: badBytes,
    }, env);

    const crossUser = await app.request(`/api/media/assets/${intent.asset_id}/content`, {
      headers: { Authorization: 'Bearer session-2' },
    }, env);
    expect(crossUser.status).toBe(404);

    const finalize = await app.request(`/api/media/assets/${intent.asset_id}/finalize-upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(finalize.status).toBe(400);
    expect(await finalize.json()).toMatchObject({ error: 'unsupported_type' });
  });

  it('rejects expired or tampered signed provider URLs', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    const bytes = pngBytes(8, 8);
    (env.R2 as any).objects.set('media/u1/inputs/asset-1/original.png', {
      bytes,
      contentType: 'image/png',
    });
    db.exec(`
      INSERT INTO media_assets (
        id, user_id, asset_type, source, r2_key, original_filename, mime_type,
        file_size, width, height, metadata_json, lifecycle_status, created_at, updated_at
      )
      VALUES (
        'asset-1', 'u1', 'image', 'upload', 'media/u1/inputs/asset-1/original.png',
        'asset.png', 'image/png', ${bytes.byteLength}, 8, 8, '{}', 'active', 0, 0
      );
    `);

    const expired = await app.request('/api/media/provider-assets/asset-1?purpose=provider_input&exp=1&sig=bad', {}, env);
    expect(expired.status).toBe(403);
  });
});

describe('Creative Studio Phase 2 reference resolver', () => {
  beforeEach(() => {
    // no-op; each test creates its own env
  });

  it('parses prompt mentions without duplicates', () => {
    expect(parsePromptMentions('ให้ @subject ถือสินค้า แล้วใช้แสงแบบ @style และ @subject อีกครั้ง')).toEqual(['subject', 'style']);
  });

  it('validates references against model capability and asset ownership', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    db.exec(`
      INSERT INTO media_assets (
        id, user_id, asset_type, source, r2_key, original_filename, mime_type,
        file_size, width, height, metadata_json, lifecycle_status, created_at, updated_at
      )
      VALUES (
        'asset-subject', 'u1', 'image', 'upload', 'media/u1/inputs/asset-subject/original.png',
        'subject.png', 'image/png', 29, 32, 24, '{}', 'active', 0, 0
      );
    `);

    const resolved = await validateReferencesForModel(env, 'u1', {
      model_id: 'minimax-image-01-i2i-subject',
      prompt: 'ทำภาพใหม่โดยรักษาใบหน้า @subject',
      references: [{ asset_id: 'asset-subject', mention_name: '@subject', reference_role: 'subject' }],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.resolved.references[0]).toMatchObject({ mention_name: 'subject', influence_level: 'balanced' });

    const unresolved = await validateReferencesForModel(env, 'u1', {
      model_id: 'minimax-image-01-i2i-subject',
      prompt: 'ทำภาพใหม่โดยรักษาใบหน้า @missing',
      references: [{ asset_id: 'asset-subject', mention_name: 'subject', reference_role: 'subject' }],
    });
    expect(unresolved).toMatchObject({ ok: false, error: 'unresolved_prompt_mentions', unresolved_mentions: ['missing'] });

    const tooMany = await validateReferencesForModel(env, 'u1', {
      model_id: 'minimax-image-01-i2i-subject',
      prompt: '@subject @style',
      references: [
        { asset_id: 'asset-subject', mention_name: 'subject', reference_role: 'subject' },
        { asset_id: 'asset-subject', mention_name: 'style', reference_role: 'subject' },
      ],
    });
    expect(tooMany).toMatchObject({ ok: false, error: 'reference_count_not_supported' });
  });

  it('exposes reference validation through the media route', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    db.exec(`
      INSERT INTO media_assets (
        id, user_id, asset_type, source, r2_key, original_filename, mime_type,
        file_size, width, height, metadata_json, lifecycle_status, created_at, updated_at
      )
      VALUES (
        'asset-subject', 'u1', 'image', 'upload', 'media/u1/inputs/asset-subject/original.png',
        'subject.png', 'image/png', 29, 32, 24, '{}', 'active', 0, 0
      );
    `);

    const res = await app.request('/api/media/references/validate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-i2i-subject',
        prompt: 'ภาพ portrait ของ @subject',
        references: [{ asset_id: 'asset-subject', mention_name: 'subject', reference_role: 'subject' }],
      }),
    }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ prompt_mentions: ['subject'] });
  });
});

describe('Creative Studio Phase 3 generation lifecycle', () => {
  it('creates an idempotent generation, reserves credits, processes MiniMax output, ingests to R2, and finalizes hold', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    env.__MEDIA_PROVIDER_FETCH = async () => new Response(JSON.stringify({
      id: 'provider-request-1',
      data: { image_base64: [pngBase64(64, 48)] },
      base_resp: { status_code: 0, status_msg: 'success' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1, prompt_optimizer: true },
        reference_count: 0,
      }),
    }, env);
    expect(quote.status).toBe(200);
    const quoteBody = await quote.json() as any;

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-generation-1',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'ภาพ workshop AI สำหรับ SME',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1, prompt_optimizer: true },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(create.status).toBe(201);
    const created = await create.json() as any;
    expect(created.generation).toMatchObject({ status: 'queued', estimated_credits: 2 });
    expect(created.credits_remaining).toBe(98);

    const duplicate = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-generation-1',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'ภาพ workshop AI สำหรับ SME',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ idempotent: true });

    const processed = await runMediaProcessor(env);
    expect(processed.claimed).toBe(1);

    const row = db.prepare('SELECT status, delivered_output_count, final_credits FROM media_generations WHERE id = ?')
      .get(created.generation.id) as any;
    expect(row).toMatchObject({ status: 'completed', delivered_output_count: 1, final_credits: 2 });
    const hold = db.prepare('SELECT status, final_credits FROM media_credit_holds WHERE generation_id = ?')
      .get(created.generation.id) as any;
    expect(hold).toMatchObject({ status: 'finalized', final_credits: 2 });
    const output = db.prepare('SELECT r2_key, width, height FROM media_assets WHERE generation_id = ?')
      .get(created.generation.id) as any;
    expect(output).toMatchObject({ width: 64, height: 48 });
    expect((env.R2 as any).objects.has(output.r2_key)).toBe(true);
  });

  it('rejects idempotency-key reuse with a different request body', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    env.__MEDIA_PROVIDER_FETCH = async () => new Response(JSON.stringify({
      id: 'provider-request-idem-conflict',
      data: { image_base64: [pngBase64(64, 48)] },
      base_resp: { status_code: 0, status_msg: 'success' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;

    const first = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-conflict-1',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'original prompt',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(first.status).toBe(201);

    const second = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-conflict-1',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'a completely different prompt',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: 'idempotency_conflict' });
  });

  it('rejects a stale quote as price_changed instead of silently re-pricing', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;

    // Submitting with options that differ from what the quote was priced for
    // (aspect_ratio changed after the fact) must not be honoured at the old price.
    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-price-changed',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'try to sneak a different aspect ratio past the locked quote',
        options: { aspect_ratio: '16:9', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(create.status).toBe(409);
    expect(await create.json()).toMatchObject({ error: 'price_changed' });

    const userAfter = db.prepare('SELECT credits FROM users WHERE id = ?').get('u1') as any;
    expect(userAfter.credits).toBe(100); // untouched — no upward true-up, no charge on a rejected quote
  });

  it('rejects generation when the user has insufficient credits and refunds nothing extra', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    db.exec("UPDATE users SET credits = 1 WHERE id = 'u1'");

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;
    expect(quoteBody.credits).toBeGreaterThan(1); // model costs more than the user's balance

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-insufficient-credits',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'this should be rejected for lack of credits',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(create.status).toBe(402);
    const body = await create.json() as any;
    expect(body.error).toBe('insufficient_credits');

    const userAfter = db.prepare('SELECT credits FROM users WHERE id = ?').get('u1') as any;
    expect(userAfter.credits).toBe(1); // balance is untouched, not partially deducted

    const generationRow = db.prepare(
      "SELECT status, error_code FROM media_generations WHERE user_id = 'u1' ORDER BY created_at DESC LIMIT 1",
    ).get() as any;
    expect(generationRow).toMatchObject({ status: 'failed', error_code: 'insufficient_credits' });

    const holdRow = db.prepare('SELECT COUNT(*) as count FROM media_credit_holds WHERE user_id = ?').get('u1') as any;
    expect(holdRow.count).toBe(0); // no hold was ever created for a reservation that failed
  });

  it('denies a different user from reading or cancelling someone else\'s generation', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    env.__MEDIA_PROVIDER_FETCH = async () => new Promise(() => {}); // never resolves; generation stays queued

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-cross-user',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'owned by user one only',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(create.status).toBe(201);
    const created = await create.json() as any;

    const getAsOwner = await app.request(`/api/media/generations/${created.generation.id}`, {
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(getAsOwner.status).toBe(200);

    const getAsOther = await app.request(`/api/media/generations/${created.generation.id}`, {
      headers: { Authorization: 'Bearer session-2' },
    }, env);
    expect(getAsOther.status).toBe(404);

    const cancelAsOther = await app.request(`/api/media/generations/${created.generation.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-2', 'Content-Type': 'application/json' },
    }, env);
    expect(cancelAsOther.status).toBe(404);

    const row = db.prepare('SELECT status, user_id FROM media_generations WHERE id = ?').get(created.generation.id) as any;
    expect(row).toMatchObject({ user_id: 'u1' }); // untouched by user two's cancel attempt
    expect(row.status).not.toBe('cancelled');
  });

  it('holds credits through a transient R2 failure and finalizes on the retried delivery', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    let putCalls = 0;
    const realR2 = env.R2 as any;
    env.R2 = {
      ...realR2,
      async put(...args: any[]) {
        putCalls += 1;
        if (putCalls === 1) throw new Error('simulated transient R2 outage');
        return realR2.put(...args);
      },
    } as any;
    env.__MEDIA_PROVIDER_FETCH = async () => new Response(JSON.stringify({
      id: 'provider-request-r2-retry',
      data: { image_base64: [pngBase64(64, 48)] },
      base_resp: { status_code: 0, status_msg: 'success' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-r2-retry',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'should survive a transient storage failure',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    const created = await create.json() as any;

    await runMediaProcessor(env); // submit_generation: provider succeeds, R2 ingest fails once

    const afterFirstPass = db.prepare('SELECT status, delivery_status, error_code FROM media_generations WHERE id = ?')
      .get(created.generation.id) as any;
    expect(afterFirstPass).toMatchObject({ status: 'delivery_pending', delivery_status: 'ingesting', error_code: 'storage_failed' });
    const holdAfterFirstPass = db.prepare('SELECT status FROM media_credit_holds WHERE generation_id = ?')
      .get(created.generation.id) as any;
    expect(holdAfterFirstPass.status).toBe('reserved'); // not finalized, not refunded — still in flight

    // The retry work item has a short backoff; fast-forward past it and reprocess.
    await runMediaProcessor(env, Date.now() + 20_000);

    const afterRetry = db.prepare('SELECT status, delivered_output_count, final_credits FROM media_generations WHERE id = ?')
      .get(created.generation.id) as any;
    expect(afterRetry).toMatchObject({ status: 'completed', delivered_output_count: 1 });
    const holdAfterRetry = db.prepare('SELECT status, final_credits FROM media_credit_holds WHERE generation_id = ?')
      .get(created.generation.id) as any;
    expect(holdAfterRetry).toMatchObject({ status: 'finalized', final_credits: 2 });
  });

  it('refunds reserved credits on provider failure', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    env.__MEDIA_PROVIDER_FETCH = async () => new Response(JSON.stringify({
      id: 'provider-request-fail',
      data: {},
      base_resp: { status_code: 2013, status_msg: 'invalid params' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const quoteResult = await createPricingQuote(env, 'u1', {
      model_id: 'minimax-image-01-t2i',
      options: { aspect_ratio: '1:1', response_format: 'url', num_images: 1 },
      reference_count: 0,
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-generation-fail',
      },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'fail this generation',
        options: { aspect_ratio: '1:1', response_format: 'url', num_images: 1 },
        quote_id: quoteResult.quote.quote_id,
        expected_pricing_version: quoteResult.quote.pricing_version,
      }),
    }, env);
    expect(create.status).toBe(201);
    const created = await create.json() as any;

    await runMediaProcessor(env);

    const generation = db.prepare('SELECT status, error_code FROM media_generations WHERE id = ?')
      .get(created.generation.id) as any;
    expect(generation.status).toBe('failed');
    const hold = db.prepare('SELECT status, final_credits FROM media_credit_holds WHERE generation_id = ?')
      .get(created.generation.id) as any;
    expect(hold).toMatchObject({ status: 'refunded', final_credits: 0 });
    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get('u1') as any;
    expect(user.credits).toBe(100);
  });
});

describe('fal.ai provider — admin-managed key, catalog gating, and generation flow', () => {
  function makeEnvWithAdmin() {
    const ctx = makeEnv({ creative: true, brand: true });
    const userColumns = (ctx.db.prepare('PRAGMA table_info(users)').all() as any[]).map((column) => column.name);
    if (!userColumns.includes('role')) ctx.db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    ctx.db.exec(`
      INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
      VALUES ('admin1', 'admin1@test.com', 'x', 'Admin One', 'free', 'admin', 100, 0, 0);
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES ('session-admin', 'admin1', ${Date.now() + 60_000}, 0);
    `);
    return ctx;
  }

  it('seeds the fal model in maintenance mode until an admin configures a key', async () => {
    const { env } = makeEnvWithAdmin();

    // Maintenance models are intentionally hidden from the public catalog...
    const models = await listActiveMediaModels(env);
    expect(models.find((m) => m.id === 'fal-flux-dev-t2i')).toBeUndefined();

    // ...but the row exists and is correctly flagged as unconfigured/in-maintenance.
    const raw = await getModelById(env, 'fal-flux-dev-t2i');
    expect(raw).toMatchObject({ provider: 'fal', is_maintenance: 1 });
  });

  it('rejects non-admins and unknown providers when setting a platform key', async () => {
    const { env } = makeEnvWithAdmin();

    const asUser = await app.request('/api/admin/creative/providers/fal/key', {
      method: 'PUT',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'fal-test-key-123' }),
    }, env);
    expect(asUser.status).toBe(403);

    const unknownProvider = await app.request('/api/admin/creative/providers/not-a-real-provider/key', {
      method: 'PUT',
      headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'whatever' }),
    }, env);
    expect(unknownProvider.status).toBe(404);
  });

  it('lets an admin set a fal key, masks it everywhere, and auto-lifts model maintenance', async () => {
    const { env, db } = makeEnvWithAdmin();
    await listActiveMediaModels(env); // ensure catalog seeded first

    const setKey = await app.request('/api/admin/creative/providers/fal/key', {
      method: 'PUT',
      headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'fal-secret-abcd1234' }),
    }, env);
    expect(setKey.status).toBe(200);
    const setKeyBody = await setKey.json() as any;
    expect(setKeyBody.key_hint).toBe('••••1234');
    expect(JSON.stringify(setKeyBody)).not.toContain('fal-secret-abcd1234'); // plaintext never returned

    const encryptedRow = db.prepare('SELECT encrypted_key FROM platform_provider_keys WHERE provider = ?').get('fal') as any;
    expect(encryptedRow.encrypted_key).not.toContain('fal-secret-abcd1234'); // stored encrypted, not plaintext

    const listResult = await app.request('/api/admin/creative/providers', {
      headers: { Authorization: 'Bearer session-admin' },
    }, env);
    const listBody = await listResult.json() as any;
    expect(listBody.providers).toContainEqual(expect.objectContaining({ provider: 'fal', key_hint: '••••1234' }));

    const modelRow = db.prepare("SELECT is_maintenance FROM ai_models WHERE id = 'fal-flux-dev-t2i'").get() as any;
    expect(modelRow.is_maintenance).toBe(0); // maintenance lifted automatically by setting the key
  });

  it('runs a full fal generation once a key is configured, mapping fal.run response shape correctly', async () => {
    const { env, db } = makeEnvWithAdmin();
    await app.request('/api/admin/creative/providers/fal/key', {
      method: 'PUT',
      headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'fal-real-key-9999' }),
    }, env);

    let capturedRequest: { url: string; headers: Record<string, string>; body: any } | null = null;
    env.__MEDIA_PROVIDER_FETCH = async (url: string, init?: any) => {
      if (url === 'https://fal.media/files/output/example.png') {
        // the processor downloads the provider's output URL to ingest it into R2
        return new Response(pngBytes(64, 48), { status: 200 });
      }
      capturedRequest = {
        url,
        headers: init.headers,
        body: JSON.parse(init.body),
      };
      return new Response(JSON.stringify({
        request_id: 'fal-req-1',
        images: [{ url: 'https://fal.media/files/output/example.png', width: 512, height: 512 }],
        seed: 42,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'fal-flux-dev-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '16:9', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    expect(quote.status).toBe(200);
    const quoteBody = await quote.json() as any;

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-fal-1',
      },
      body: JSON.stringify({
        model_id: 'fal-flux-dev-t2i',
        prompt: 'a fal-generated marketing banner',
        options: { aspect_ratio: '16:9', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    expect(create.status).toBe(201);
    const created = await create.json() as any;

    await runMediaProcessor(env);

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe('https://fal.run/fal-ai/flux/dev');
    expect(capturedRequest!.headers.Authorization).toBe('Key fal-real-key-9999');
    expect(capturedRequest!.body).toMatchObject({ image_size: 'landscape_16_9', num_images: 1 });

    const row = db.prepare('SELECT status, delivered_output_count FROM media_generations WHERE id = ?')
      .get(created.generation.id) as any;
    expect(row).toMatchObject({ status: 'completed', delivered_output_count: 1 });
    const hold = db.prepare('SELECT status FROM media_credit_holds WHERE generation_id = ?')
      .get(created.generation.id) as any;
    expect(hold.status).toBe('finalized');
  });

  it('fails generation gracefully (with refund) when fal is selected but no key has been configured yet', async () => {
    const { env, db } = makeEnvWithAdmin();
    await listActiveMediaModels(env);
    // Admin has not set a key — force the model out of maintenance to simulate
    // an operator mistake, and confirm the system still fails safely rather than crashing.
    db.exec("UPDATE ai_models SET is_maintenance = 0 WHERE id = 'fal-flux-dev-t2i'");

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'fal-flux-dev-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-1',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-fal-not-configured',
      },
      body: JSON.stringify({
        model_id: 'fal-flux-dev-t2i',
        prompt: 'should fail cleanly, not crash',
        options: { aspect_ratio: '1:1', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    const created = await create.json() as any;

    await runMediaProcessor(env);

    const row = db.prepare('SELECT status, error_code FROM media_generations WHERE id = ?')
      .get(created.generation.id) as any;
    expect(row).toMatchObject({ status: 'failed', error_code: 'provider_not_configured' });
    const hold = db.prepare('SELECT status FROM media_credit_holds WHERE generation_id = ?')
      .get(created.generation.id) as any;
    expect(hold.status).toBe('refunded'); // no charge for a provider that was never actually configured
  });
});

describe('Admin ops — category rate limits, storage quota, purge worker, stuck-job reconciliation', () => {
  async function uploadAndFinalize(env: any, sizeBytes = pngBytes().byteLength) {
    const bytes = pngBytes();
    const intentRes = await app.request('/api/media/assets/upload-intents', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'ref.png', mime_type: 'image/png', file_size: sizeBytes, asset_type: 'image' }),
    }, env);
    const intent = await intentRes.json() as any;
    await app.request(intent.upload_url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-1',
        'X-Upload-Token': intent.upload_token,
        'Content-Type': 'image/png',
        'Content-Length': String(bytes.byteLength),
      },
      body: bytes,
    }, env);
    const finalizeRes = await app.request(`/api/media/assets/${intent.asset_id}/finalize-upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    return { intentRes, finalizeRes, assetId: intent.asset_id };
  }

  it('rate-limits uploads and generations under separate category buckets', async () => {
    const { env } = makeEnv({ creative: true, brand: true });

    let lastUploadStatus = 200;
    for (let i = 0; i < 21; i += 1) {
      const res = await app.request('/api/media/assets/upload-intents', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: `f${i}.png`, mime_type: 'image/png', file_size: 100, asset_type: 'image' }),
      }, env);
      lastUploadStatus = res.status;
    }
    expect(lastUploadStatus).toBe(429); // 21st upload-category request in the same minute is throttled

    // A generation-category request in the same window must not be affected —
    // separate bucket. (It may still 400 on missing fields; it must not be 429.)
    const genRes = await app.request('/api/media/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-ratelimit-check' },
      body: JSON.stringify({}),
    }, env);
    expect(genRes.status).not.toBe(429);
  });

  it('rejects finalize-upload once a user is over their storage quota, and cleans up the quarantine object', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    env.MEDIA_STORAGE_QUOTA_MB = String(10 / (1024 * 1024)); // ~10 bytes — smaller than the 29-byte PNG fixture

    const { finalizeRes, assetId } = await uploadAndFinalize(env);
    expect(finalizeRes.status).toBe(413);
    expect(await finalizeRes.json()).toMatchObject({ error: 'storage_quota_exceeded' });

    const asset = db.prepare('SELECT lifecycle_status FROM media_assets WHERE id = ?').get(assetId) as any;
    expect(asset.lifecycle_status).toBe('rejected');
    const intent = db.prepare("SELECT status, quarantine_r2_key FROM media_upload_intents WHERE asset_id = ?").get(assetId) as any;
    expect(intent.status).toBe('rejected');
    expect((env.R2 as any).objects.has(intent.quarantine_r2_key)).toBe(false); // quarantine object cleaned up, not left behind
  });

  it('allows finalize-upload when comfortably under quota', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    // default quota (1000MB) — a ~1KB PNG fixture is nowhere close
    const { finalizeRes } = await uploadAndFinalize(env);
    expect(finalizeRes.status).toBe(200);
  });

  it('purges an archived asset past its retention window and reclaims the R2 object', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    const { assetId } = await uploadAndFinalize(env);

    const archiveRes = await app.request(`/api/media/assets/${assetId}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ lifecycle_status: 'archived' }),
    }, env);
    expect(archiveRes.status).toBe(200);
    const archived = db.prepare('SELECT r2_key, purge_after FROM media_assets WHERE id = ?').get(assetId) as any;
    expect(archived.purge_after).toBeGreaterThan(Date.now()); // countdown started, not immediately purgeable
    expect((env.R2 as any).objects.has(archived.r2_key)).toBe(true); // still there — not purged yet

    // Sweeping "now" does nothing yet (retention window hasn't passed)...
    const tooSoon = await sweepMediaPurge(env, Date.now());
    expect(tooSoon.purgedAssets).toBe(0);
    expect((env.R2 as any).objects.has(archived.r2_key)).toBe(true);

    // ...but sweeping past the 30-day retention window purges it for real.
    const later = await sweepMediaPurge(env, archived.purge_after + 1);
    expect(later.purgedAssets).toBe(1);
    expect((env.R2 as any).objects.has(archived.r2_key)).toBe(false);
    const purged = db.prepare('SELECT lifecycle_status FROM media_assets WHERE id = ?').get(assetId) as any;
    expect(purged.lifecycle_status).toBe('purged');
  });

  it('cleans up an abandoned upload intent past its expiry, deleting the quarantine object', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    const bytes = pngBytes();
    const intentRes = await app.request('/api/media/assets/upload-intents', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'abandoned.png', mime_type: 'image/png', file_size: bytes.byteLength, asset_type: 'image' }),
    }, env);
    const intent = await intentRes.json() as any;
    // Never PUT the bytes or finalize — simulate the user closing the tab mid-upload.

    const row = db.prepare('SELECT quarantine_r2_key, expires_at FROM media_upload_intents WHERE asset_id = ?').get(intent.asset_id) as any;
    // Manually stash something in the quarantine key so we can prove it gets deleted.
    await env.R2.put(row.quarantine_r2_key, bytes);
    expect((env.R2 as any).objects.has(row.quarantine_r2_key)).toBe(true);

    const tooSoon = await sweepMediaPurge(env, Date.now());
    expect(tooSoon.expiredIntents).toBe(0); // hasn't expired yet

    const swept = await sweepMediaPurge(env, row.expires_at + 1);
    expect(swept.expiredIntents).toBe(1);
    expect((env.R2 as any).objects.has(row.quarantine_r2_key)).toBe(false);
    const after = db.prepare('SELECT status FROM media_upload_intents WHERE asset_id = ?').get(intent.asset_id) as any;
    expect(after.status).toBe('expired');
  });

  it('refunds a generation that blew past its delivery deadline without ever completing', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    env.__MEDIA_PROVIDER_FETCH = async () => new Promise(() => {}); // never resolves

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;

    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-deadline-1' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i',
        prompt: 'stuck forever without a reconciler',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 },
        references: [],
        quote_id: quoteBody.quote_id,
        expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    const created = await create.json() as any;

    const before = db.prepare('SELECT delivery_deadline_at FROM media_generations WHERE id = ?').get(created.generation.id) as any;

    // Reconciling before the deadline: no action.
    const tooSoon = await reconcileStuckGenerations(env, before.delivery_deadline_at - 1);
    expect(tooSoon.expired).toBe(0);
    const holdStillReserved = db.prepare('SELECT status FROM media_credit_holds WHERE generation_id = ?').get(created.generation.id) as any;
    expect(holdStillReserved.status).toBe('reserved');

    // Past the deadline: refund, and mark the generation failed.
    const result = await reconcileStuckGenerations(env, before.delivery_deadline_at + 1);
    expect(result.expired).toBe(1);
    const generation = db.prepare('SELECT status, error_code FROM media_generations WHERE id = ?').get(created.generation.id) as any;
    expect(generation).toMatchObject({ status: 'failed', error_code: 'delivery_deadline_exceeded' });
    const hold = db.prepare('SELECT status FROM media_credit_holds WHERE generation_id = ?').get(created.generation.id) as any;
    expect(hold.status).toBe('refunded');
    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get('u1') as any;
    expect(user.credits).toBe(100); // fully refunded, nothing lost
  });

  it('releases an abandoned upload intent\'s quota footprint, not just its R2 object', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    env.MEDIA_STORAGE_QUOTA_MB = '1'; // 1MB quota

    const bigSize = 900 * 1024; // 900KB declared size, never actually uploaded
    const intentRes = await app.request('/api/media/assets/upload-intents', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'abandoned.png', mime_type: 'image/png', file_size: bigSize, asset_type: 'image' }),
    }, env);
    const intent = await intentRes.json() as any;
    // Never PUT the bytes or finalize — simulate the user closing the tab mid-upload.

    const row = db.prepare('SELECT expires_at FROM media_upload_intents WHERE asset_id = ?').get(intent.asset_id) as any;
    const swept = await sweepMediaPurge(env, row.expires_at + 1);
    expect(swept.expiredIntents).toBe(1);

    const asset = db.prepare('SELECT lifecycle_status FROM media_assets WHERE id = ?').get(intent.asset_id) as any;
    expect(asset.lifecycle_status).toBe('rejected'); // no longer 'upload_pending' — released from quota accounting

    // Repeat this 2 more times to accumulate ~2.7MB of declared-but-never-stored
    // bytes against a 1MB quota. If any of these still counted as "used"
    // storage, the quota would be blown even though zero bytes are stored.
    for (let i = 0; i < 2; i += 1) {
      const r = await app.request('/api/media/assets/upload-intents', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: `abandoned${i}.png`, mime_type: 'image/png', file_size: bigSize, asset_type: 'image' }),
      }, env);
      const it2 = await r.json() as any;
      const row2 = db.prepare('SELECT expires_at FROM media_upload_intents WHERE asset_id = ?').get(it2.asset_id) as any;
      await sweepMediaPurge(env, row2.expires_at + 1);
    }

    // A real, tiny upload should easily fit in a 1MB quota, since nothing
    // was ever really stored by the abandoned intents above.
    const { finalizeRes } = await uploadAndFinalize(env, pngBytes().byteLength);
    expect(finalizeRes.status).toBe(200);
  });

  it('refunds the hold before marking the generation failed, so a crash between the two steps self-heals on the next reconciler tick', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    env.__MEDIA_PROVIDER_FETCH = async () => new Promise(() => {});

    const quote = await app.request('/api/media/pricing/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i', operation: 'text_to_image',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 }, reference_count: 0,
      }),
    }, env);
    const quoteBody = await quote.json() as any;
    const create = await app.request('/api/media/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-orphan-1' },
      body: JSON.stringify({
        model_id: 'minimax-image-01-t2i', prompt: 'simulate crash between fail and refund',
        options: { aspect_ratio: '1:1', response_format: 'base64', num_images: 1 }, references: [],
        quote_id: quoteBody.quote_id, expected_pricing_version: quoteBody.pricing_version,
      }),
    }, env);
    const created = await create.json() as any;
    const deadline = db.prepare('SELECT delivery_deadline_at FROM media_generations WHERE id = ?')
      .get(created.generation.id) as any;
    const pastDeadline = deadline.delivery_deadline_at + 1;

    // Simulate exactly what reconciler.ts's refundExpiredGenerations does,
    // but stop right after the refund — as if the worker died / threw right
    // after refundMediaHold but before markGenerationFailed (e.g. a
    // transient D1 error, CPU-limit eviction, etc. on the second write).
    const { refundMediaHold } = await import('../src/lib/media/credits');
    await refundMediaHold(env, created.generation.id, 'delivery_deadline_exceeded', pastDeadline);

    const genAfterCrash = db.prepare('SELECT status FROM media_generations WHERE id = ?').get(created.generation.id) as any;
    expect(genAfterCrash.status).not.toBe('failed'); // still non-terminal — markGenerationFailed never ran
    const holdAfterCrash = db.prepare('SELECT status FROM media_credit_holds WHERE generation_id = ?').get(created.generation.id) as any;
    expect(holdAfterCrash.status).toBe('refunded'); // credits already refunded

    // Now the NEXT cron tick runs reconcileStuckGenerations, past the
    // delivery deadline. Because the generation's status is still
    // non-terminal, it must be picked up again by the NON_TERMINAL_STATUSES
    // query, and both calls (idempotent refund, then mark-failed) must
    // complete cleanly this time.
    const result = await reconcileStuckGenerations(env, pastDeadline + 1000);
    expect(result.expired).toBe(1);

    const genAfterReconcile = db.prepare('SELECT status FROM media_generations WHERE id = ?').get(created.generation.id) as any;
    expect(genAfterReconcile.status).toBe('failed'); // now properly finalized
    const holdAfterReconcile = db.prepare('SELECT status FROM media_credit_holds WHERE generation_id = ?').get(created.generation.id) as any;
    expect(holdAfterReconcile.status).toBe('refunded');
    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get('u1') as any;
    expect(user.credits).toBe(100); // exactly one refund's worth — no double-refund from the idempotent replay
  });

  it('emails ops once when jobs are stuck, then throttles repeat alerts within the hour', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    const now = Date.now();
    db.exec(`
      INSERT INTO media_work_items (id, work_type, dedupe_key, status, available_at, attempts, max_attempts, payload_json, created_at, updated_at)
      VALUES ('wi1', 'submit_generation', 'dedupe-wi1', 'dead_letter', ${now}, 3, 3, '{}', ${now}, ${now});
    `);

    const first = await reconcileStuckGenerations(env, now);
    expect(first).toMatchObject({ deadLetters: 1, alerted: true });
    const outboxAfterFirst = db.prepare("SELECT COUNT(*) as count FROM email_outbox WHERE subject LIKE '%Stuck jobs%'").get() as any;
    expect(outboxAfterFirst.count).toBe(1);

    // Immediately reconciling again must not send a second email — throttled.
    const second = await reconcileStuckGenerations(env, now + 1000);
    expect(second.alerted).toBe(false);
    const outboxAfterSecond = db.prepare("SELECT COUNT(*) as count FROM email_outbox WHERE subject LIKE '%Stuck jobs%'").get() as any;
    expect(outboxAfterSecond.count).toBe(1); // still just the one

    // After the throttle window passes, it can alert again.
    const third = await reconcileStuckGenerations(env, now + 61 * 60 * 1000);
    expect(third.alerted).toBe(true);
    const outboxAfterThird = db.prepare("SELECT COUNT(*) as count FROM email_outbox WHERE subject LIKE '%Stuck jobs%'").get() as any;
    expect(outboxAfterThird.count).toBe(2);
  });
});

describe('Thumbnail generation and background removal — real implementations, not stubs', () => {
  async function uploadAndFinalizeRealPng(env: any) {
    const bytes = validPngBytes();
    const intentRes = await app.request('/api/media/assets/upload-intents', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'swatch.png', mime_type: 'image/png', file_size: bytes.byteLength, asset_type: 'image' }),
    }, env);
    const intent = await intentRes.json() as any;
    await app.request(intent.upload_url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-1',
        'X-Upload-Token': intent.upload_token,
        'Content-Type': 'image/png',
        'Content-Length': String(bytes.byteLength),
      },
      body: bytes,
    }, env);
    const finalizeRes = await app.request(`/api/media/assets/${intent.asset_id}/finalize-upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(finalizeRes.status).toBe(200);
    return intent.asset_id as string;
  }

  it('derives a real webp thumbnail from an uploaded image, stored in R2 and linked on the asset row', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    const assetId = await uploadAndFinalizeRealPng(env);

    const res = await app.request(`/api/media/assets/${assetId}/derive-thumbnail`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.thumbnail_r2_key).toBe(`media/u1/thumbnails/${assetId}.webp`);

    const stored = (env.R2 as any).objects.get(body.thumbnail_r2_key);
    expect(stored).toBeTruthy();
    // Valid WebP starts with the RIFF magic bytes.
    expect(Array.from(stored.bytes.slice(0, 4))).toEqual([0x52, 0x49, 0x46, 0x46]);
    expect(stored.bytes.byteLength).toBeGreaterThan(0);
    expect(stored.bytes.byteLength).toBeLessThan(validPngBytes().byteLength * 5); // sanity: not wildly bloated

    const row = db.prepare('SELECT thumbnail_r2_key FROM media_assets WHERE id = ?').get(assetId) as any;
    expect(row.thumbnail_r2_key).toBe(body.thumbnail_r2_key);
  });

  it('rejects deriving a thumbnail for another user\'s asset or a missing asset', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    const assetId = await uploadAndFinalizeRealPng(env);

    const asOther = await app.request(`/api/media/assets/${assetId}/derive-thumbnail`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-2' },
    }, env);
    expect(asOther.status).toBe(404);

    const missing = await app.request(`/api/media/assets/does-not-exist/derive-thumbnail`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(missing.status).toBe(404);
  });

  it('remove-background fails cleanly (503) when no fal key is configured yet', async () => {
    const { env } = makeEnv({ creative: true, brand: true });
    const assetId = await uploadAndFinalizeRealPng(env);

    const res = await app.request(`/api/media/assets/${assetId}/remove-background`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'fal_not_configured' });
  });

  it('removes the background via fal once configured, storing a new derived asset without touching the original', async () => {
    const { env, db } = makeEnv({ creative: true, brand: true });
    const userColumns = (db.prepare('PRAGMA table_info(users)').all() as any[]).map((c) => c.name);
    if (!userColumns.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    db.exec(`
      INSERT INTO users (id, email, password_hash, name, plan, role, credits, created_at, updated_at)
      VALUES ('admin1', 'admin1@test.com', 'x', 'Admin One', 'free', 'admin', 100, 0, 0);
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES ('session-admin', 'admin1', ${Date.now() + 60_000}, 0);
    `);
    await app.request('/api/admin/creative/providers/fal/key', {
      method: 'PUT',
      headers: { Authorization: 'Bearer session-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'fal-rembg-test-key' }),
    }, env);

    const assetId = await uploadAndFinalizeRealPng(env);

    let sawRembgCall = false;
    env.__MEDIA_PROVIDER_FETCH = async (url: string, init?: any) => {
      if (url === 'https://fal.run/fal-ai/imageutils/rembg') {
        sawRembgCall = true;
        const body = JSON.parse(init.body);
        expect(body.image_url).toContain(`/api/media/provider-assets/${assetId}`);
        return new Response(JSON.stringify({ image: { url: 'https://fal.media/files/output/no-bg.png' } }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://fal.media/files/output/no-bg.png') {
        return new Response(validPngBytes(), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    };

    const res = await app.request(`/api/media/assets/${assetId}/remove-background`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-1' },
    }, env);
    expect(res.status).toBe(201);
    expect(sawRembgCall).toBe(true);
    const body = await res.json() as any;
    expect(body.asset.id).not.toBe(assetId); // a new asset, not a mutation of the original
    expect(body.asset.metadata.derived).toMatchObject({ operation: 'remove_background', source_asset_id: assetId });

    const originalRow = db.prepare('SELECT r2_key, lifecycle_status FROM media_assets WHERE id = ?').get(assetId) as any;
    expect(originalRow.lifecycle_status).toBe('active'); // original untouched
    const newRow = db.prepare('SELECT source, r2_key FROM media_assets WHERE id = ?').get(body.asset.id) as any;
    expect(newRow.source).toBe('derived');
    expect((env.R2 as any).objects.has(newRow.r2_key)).toBe(true);
    expect(newRow.r2_key).not.toBe(originalRow.r2_key);
  });
});
