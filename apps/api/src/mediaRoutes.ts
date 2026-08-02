import { Hono } from 'hono';
import type { Bindings, Variables } from './lib/types';
import { categoryRateLimit, getUser, requireAuth } from './lib/middleware';
import { createPricingQuote, listActiveMediaModels } from './lib/media/catalog';
import {
  createBrandContextSnapshot,
  createBrandProfile,
  getActiveBrandProfile,
  listBrandProfiles,
  setActiveBrandProfile,
} from './lib/creative/brandContext';
import { runMediaProcessor } from './lib/media/processor';
import { reconcileStuckGenerations } from './lib/media/reconciler';
import { sweepMediaPurge } from './lib/media/purge';
import {
  createUploadIntent,
  deleteAsset,
  favoriteAsset,
  finalizeUploadedAsset,
  getAsset,
  getAssetById,
  getAssetRow,
  listAssets,
  patchAsset,
  putUploadBytes,
  readAssetObject,
  serializeAsset,
} from './lib/media/assets';
import { verifyMediaAssetSignature, type SignedMediaPurpose } from './lib/media/signedUrls';
import { generateThumbnailWebp } from './lib/mediaThumbnail';
import { removeBackgroundViaFal } from './lib/media/backgroundRemoval';
import { inspectImageBytes } from './lib/mediaImage';
import { generateId } from './lib/crypto';
import { checkStorageQuota } from './lib/media/quota';
import { validateReferencesForModel } from './lib/media/referenceResolver';
import {
  createMediaGeneration,
  getGeneration,
  listGenerations,
  requestCancelGeneration,
  serializeGeneration,
} from './lib/media/generations';

const mediaRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

mediaRoutes.use('/api/media/*', async (c, next) => {
  if (c.env.CREATIVE_STUDIO_ENABLED !== 'true') {
    return c.json({ error: 'feature_disabled', message: 'Creative Studio is not enabled' }, 404);
  }
  if (c.req.path.startsWith('/api/media/provider-assets/')) {
    await next();
    return;
  }
  return requireAuth(c, next);
});

// Category-scoped limits, separate from the flat 30/min IP limit used elsewhere —
// uploads and generations have very different cost/abuse profiles than plain reads.
mediaRoutes.use('/api/media/assets/upload-intents', categoryRateLimit('media_upload', 20));
mediaRoutes.use('/api/media/uploads/*', categoryRateLimit('media_upload', 30));
mediaRoutes.use('/api/media/assets/:id/finalize-upload', categoryRateLimit('media_upload', 20));
mediaRoutes.use('/api/media/generations', categoryRateLimit('media_generate', 10));
mediaRoutes.use('/api/media/generations/:id/retry', categoryRateLimit('media_generate', 10));

const requireBrandContextFeature = async (c: any, next: any) => {
  if (c.env.BRAND_CONTEXT_ENABLED !== 'true') {
    return c.json({ error: 'feature_disabled', message: 'Brand Context is not enabled' }, 404);
  }
  await next();
};

mediaRoutes.use('/api/brand-profiles', requireAuth, requireBrandContextFeature);
mediaRoutes.use('/api/brand-profiles/*', requireAuth, requireBrandContextFeature);

mediaRoutes.get('/api/media/models', async (c) => {
  const models = await listActiveMediaModels(c.env);
  return c.json({ models });
});

mediaRoutes.post('/api/media/pricing/preview', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{
    model_id?: string;
    operation?: string;
    options?: Record<string, unknown>;
    reference_count?: number;
  }>();

  if (!body.model_id) {
    return c.json({ error: 'model_id_required' }, 400);
  }

  const result = await createPricingQuote(c.env, user.id, {
    model_id: body.model_id,
    operation: body.operation,
    options: body.options,
    reference_count: body.reference_count,
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 400 | 404 | 503);
  }
  return c.json(result.quote);
});

mediaRoutes.post('/api/media/references/validate', async (c) => {
  const user = getUser(c)!;
  const result = await validateReferencesForModel(c.env, user.id, await c.req.json());
  if (!result.ok) {
    return c.json({
      error: result.error,
      unresolved_mentions: 'unresolved_mentions' in result ? result.unresolved_mentions : undefined,
    }, result.status as 400 | 404);
  }
  return c.json(result.resolved);
});

mediaRoutes.post('/api/media/generations', async (c) => {
  const user = getUser(c)!;
  const idempotencyKey = c.req.header('Idempotency-Key') || '';
  const result = await createMediaGeneration(c.env, user.id, idempotencyKey, await c.req.json());
  if (!result.ok) {
    return c.json({
      error: result.error,
      balance: 'balance' in result ? result.balance : undefined,
      unresolved_mentions: 'unresolved_mentions' in result ? result.unresolved_mentions : undefined,
    }, result.status as 400 | 402 | 404 | 409 | 429);
  }
  return c.json({
    generation: result.generation,
    credits_remaining: 'credits_remaining' in result ? result.credits_remaining : undefined,
    idempotent: 'idempotent' in result ? result.idempotent : false,
  }, 'idempotent' in result && result.idempotent ? 200 : 201);
});

mediaRoutes.get('/api/media/generations', async (c) => {
  const user = getUser(c)!;
  return c.json({ generations: await listGenerations(c.env, user.id) });
});

mediaRoutes.get('/api/media/generations/:id', async (c) => {
  const user = getUser(c)!;
  const generation = await getGeneration(c.env, user.id, c.req.param('id'));
  if (!generation) return c.json({ error: 'generation_not_found' }, 404);
  return c.json({ generation: await serializeGeneration(c.env, generation) });
});

mediaRoutes.post('/api/media/generations/:id/cancel', async (c) => {
  const user = getUser(c)!;
  const result = await requestCancelGeneration(c.env, user.id, c.req.param('id'));
  if (!result.ok) return c.json({ error: result.error }, result.status as 404);
  return c.json({ generation: result.generation });
});

mediaRoutes.post('/api/media/generations/:id/retry', async (c) => {
  return c.json({
    error: 'new_generation_required',
    message: 'Create a new quote and generation to retry a failed provider generation.',
  }, 409);
});

mediaRoutes.post('/api/media/assets/upload-intents', async (c) => {
  const user = getUser(c)!;
  const result = await createUploadIntent(c.env, user.id, await c.req.json());
  if (!result.ok) return c.json({ error: result.error }, result.status as 400);
  return c.json(result.intent, 201);
});

mediaRoutes.put('/api/media/uploads/:intentId', async (c) => {
  const user = getUser(c)!;
  const token = c.req.header('X-Upload-Token') || c.req.query('token') || '';
  const contentLength = Number(c.req.header('Content-Length') || 0);
  if (!Number.isInteger(contentLength) || contentLength < 1) {
    return c.json({ error: 'content_length_required' }, 411);
  }
  const body = c.req.raw.body;
  if (!body) return c.json({ error: 'body_required' }, 400);
  const result = await putUploadBytes(
    c.env,
    user.id,
    c.req.param('intentId'),
    token,
    body,
    contentLength,
    c.req.header('content-type'),
  );
  if (!result.ok) return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 409 | 410);
  return c.json(result);
});

mediaRoutes.post('/api/media/assets/:id/finalize-upload', async (c) => {
  const user = getUser(c)!;
  const result = await finalizeUploadedAsset(c.env, user.id, c.req.param('id'));
  if (!result.ok) return c.json({ error: result.error }, result.status as 400 | 404 | 409);
  return c.json(result.asset);
});

mediaRoutes.get('/api/media/assets', async (c) => {
  const user = getUser(c)!;
  return c.json({ assets: await listAssets(c.env, user.id) });
});

mediaRoutes.get('/api/media/assets/:id', async (c) => {
  const user = getUser(c)!;
  const origin = new URL(c.req.url).origin;
  const asset = await getAsset(c.env, user.id, c.req.param('id'), origin);
  if (!asset) return c.json({ error: 'asset_not_found' }, 404);
  return c.json(asset);
});

mediaRoutes.get('/api/media/assets/:id/content', async (c) => {
  const user = getUser(c)!;
  const asset = await getAssetById(c.env, c.req.param('id'));
  if (!asset || asset.user_id !== user.id || asset.lifecycle_status !== 'active') {
    return c.json({ error: 'asset_not_found' }, 404);
  }
  const object = await readAssetObject(c.env, asset);
  if (!object) return c.json({ error: 'asset_object_not_found' }, 404);
  return new Response(object.body, {
    headers: {
      'Content-Type': asset.mime_type,
      'Content-Length': String(asset.file_size),
      'Cache-Control': 'private, max-age=60',
    },
  });
});

mediaRoutes.get('/api/media/provider-assets/:id', async (c) => {
  const asset = await getAssetById(c.env, c.req.param('id'));
  if (!asset || asset.lifecycle_status !== 'active') return c.json({ error: 'asset_not_found' }, 404);

  const purpose = c.req.query('purpose') as SignedMediaPurpose | undefined;
  const expiresAt = Number(c.req.query('exp') || 0);
  const signature = c.req.query('sig') || '';
  if (purpose !== 'provider_input') return c.json({ error: 'invalid_media_purpose' }, 403);

  const verified = await verifyMediaAssetSignature(c.env, {
    assetId: asset.id,
    userId: asset.user_id,
    purpose,
    expiresAt,
    signature,
  });
  if (!verified) return c.json({ error: 'invalid_or_expired_signature' }, 403);

  const object = await readAssetObject(c.env, asset);
  if (!object) return c.json({ error: 'asset_object_not_found' }, 404);
  return new Response(object.body, {
    headers: {
      'Content-Type': asset.mime_type,
      'Content-Length': String(asset.file_size),
      'Cache-Control': 'private, max-age=60',
    },
  });
});

mediaRoutes.patch('/api/media/assets/:id', async (c) => {
  const user = getUser(c)!;
  const result = await patchAsset(c.env, user.id, c.req.param('id'), await c.req.json());
  if (!result.ok) return c.json({ error: result.error }, result.status as 400 | 404);
  return c.json(result.asset);
});

mediaRoutes.delete('/api/media/assets/:id', async (c) => {
  const user = getUser(c)!;
  const result = await deleteAsset(c.env, user.id, c.req.param('id'));
  if (!result.ok) return c.json({ error: result.error }, result.status as 404);
  return c.json({ ok: true });
});

mediaRoutes.post('/api/media/assets/:id/favorite', async (c) => {
  const user = getUser(c)!;
  const body: { favorite?: boolean } = await c.req.json<{ favorite?: boolean }>().catch(() => ({}));
  const result = await favoriteAsset(c.env, user.id, c.req.param('id'), body.favorite !== false);
  if (!result.ok) return c.json({ error: result.error }, result.status as 404);
  return c.json(result.asset);
});

mediaRoutes.post('/api/media/assets/:id/derive-thumbnail', async (c) => {
  const user = getUser(c)!;
  const assetId = c.req.param('id');
  const asset = await getAssetRow(c.env, user.id, assetId);
  if (!asset || asset.lifecycle_status === 'purged') return c.json({ error: 'asset_not_found' }, 404);
  if (asset.mime_type === 'font/ttf' || asset.mime_type?.startsWith('font/') || asset.mime_type?.includes('font')) {
    return c.json({ error: 'unsupported_asset_type' }, 400);
  }

  const object = await c.env.R2.get(asset.r2_key);
  if (!object) return c.json({ error: 'asset_object_missing' }, 404);
  const sourceBytes = new Uint8Array(await object.arrayBuffer());

  let thumbnailBytes: Uint8Array;
  try {
    thumbnailBytes = generateThumbnailWebp(sourceBytes);
  } catch (err: any) {
    return c.json({ error: 'thumbnail_generation_failed', message: String(err?.message || err).slice(0, 200) }, 422);
  }

  const thumbnailKey = `media/${user.id}/thumbnails/${assetId}.webp`;
  await c.env.R2.put(thumbnailKey, thumbnailBytes, { httpMetadata: { contentType: 'image/webp' } });
  const now = Date.now();
  await c.env.DB.prepare('UPDATE media_assets SET thumbnail_r2_key = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(thumbnailKey, now, assetId, user.id).run();

  return c.json({ ok: true, thumbnail_r2_key: thumbnailKey });
});

mediaRoutes.post('/api/media/assets/:id/remove-background', async (c) => {
  const user = getUser(c)!;
  const assetId = c.req.param('id');
  const sourceRow = await getAssetRow(c.env, user.id, assetId);
  if (!sourceRow || sourceRow.lifecycle_status !== 'active') return c.json({ error: 'asset_not_found' }, 404);

  const quota = await checkStorageQuota(c.env, user.id, sourceRow.file_size);
  if (!quota.ok) return c.json({ error: 'storage_quota_exceeded', used: quota.used, quota: quota.quota }, 413);

  const origin = (c.env.API_URL || c.env.WEB_URL || 'http://localhost:8787').replace(/\/$/, '');
  const sourceAsset = await getAsset(c.env, user.id, assetId, origin);
  if (!sourceAsset?.provider_url) return c.json({ error: 'asset_not_found' }, 404);

  const result = await removeBackgroundViaFal(c.env, sourceAsset.provider_url);
  if (!result.ok) return c.json({ error: result.error }, result.status as 422 | 502 | 503);

  const now = Date.now();
  const newAssetId = generateId();
  const r2Key = `media/${user.id}/derived/${newAssetId}.${result.extension}`;
  await c.env.R2.put(r2Key, result.bytes, {
    httpMetadata: { contentType: result.mimeType },
    customMetadata: { user_id: user.id, source: 'derived', derived_from: assetId },
  });

  const inspection = inspectImageBytes(result.bytes);
  const width = inspection.ok ? inspection.width : null;
  const height = inspection.ok ? inspection.height : null;

  await c.env.DB.prepare(`
    INSERT INTO media_assets (
      id, user_id, asset_type, source, r2_key, original_filename, mime_type,
      file_size, width, height, metadata_json, lifecycle_status, created_at, updated_at
    )
    VALUES (?, ?, ?, 'derived', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(
    newAssetId,
    user.id,
    sourceRow.asset_type,
    r2Key,
    sourceRow.original_filename ? `bg-removed-${sourceRow.original_filename}` : `bg-removed-${newAssetId}.${result.extension}`,
    result.mimeType,
    result.bytes.byteLength,
    width,
    height,
    JSON.stringify({ derived: { operation: 'remove_background', source_asset_id: assetId, provider: 'fal' } }),
    now,
    now,
  ).run();

  const newRow = await getAssetRow(c.env, user.id, newAssetId);
  return c.json({ ok: true, asset: serializeAsset(newRow!) }, 201);
});

mediaRoutes.get('/api/brand-profiles', async (c) => {
  const user = getUser(c)!;
  const [profiles, active] = await Promise.all([
    listBrandProfiles(c.env, user.id),
    getActiveBrandProfile(c.env, user.id),
  ]);
  return c.json({ profiles, active_profile: active });
});

mediaRoutes.post('/api/brand-profiles', async (c) => {
  const user = getUser(c)!;
  const result = await createBrandProfile(c.env, user.id, await c.req.json());
  if (!result.ok) {
    return c.json({ error: 'invalid_brand_profile', details: result.errors }, result.status as 400);
  }
  return c.json(result.profile, 201);
});

mediaRoutes.get('/api/brand-profiles/active', async (c) => {
  const user = getUser(c)!;
  return c.json({ active_profile: await getActiveBrandProfile(c.env, user.id) });
});

mediaRoutes.post('/api/brand-profiles/active', async (c) => {
  const user = getUser(c)!;
  const body = await c.req.json<{ profile_id?: string | null }>();
  const result = await setActiveBrandProfile(c.env, user.id, body.profile_id || null);
  if (!result.ok) return c.json({ error: result.error }, result.status as 404);
  return c.json({ active_profile: result.active_profile });
});

mediaRoutes.post('/api/brand-profiles/snapshots', async (c) => {
  const user = getUser(c)!;
  const body: { profile_id?: string | null } = await c.req.json<{ profile_id?: string | null }>().catch(() => ({}));
  const snapshot = await createBrandContextSnapshot(c.env, user.id, body.profile_id);
  return c.json({ snapshot }, 201);
});

export async function runMediaScheduled(env: Bindings) {
  const processed = await runMediaProcessor(env);
  const reconciled = await reconcileStuckGenerations(env);
  const purged = await sweepMediaPurge(env);
  return { ...processed, reconciled, purged };
}

export default mediaRoutes;
