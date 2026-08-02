import { generateId, generateToken, hashToken } from '../crypto';
import { inspectImageBytes } from '../mediaImage';
import type { Bindings } from '../types';
import { canonicalJson } from './catalog';
import { buildSignedMediaQuery, signMediaAssetUrl } from './signedUrls';
import { enqueueMediaWorkItem } from './workItems';
import { checkStorageQuota } from './quota';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000;
const PROVIDER_URL_TTL_MS = 10 * 60 * 1000;
export const ARCHIVED_ASSET_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SUPPORTED_UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-ttf',
  'application/x-font-otf',
]);

export type MediaAssetRow = {
  id: string;
  user_id: string;
  generation_id: string | null;
  asset_type: string;
  source: string;
  r2_key: string;
  thumbnail_r2_key: string | null;
  original_filename: string | null;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  metadata_json: string;
  favorite: number;
  lifecycle_status: string;
  checksum_sha256: string | null;
  archived_at: number | null;
  deleted_at: number | null;
  purge_after: number | null;
  created_at: number;
  updated_at: number;
};

type UploadIntentRow = {
  id: string;
  user_id: string;
  asset_id: string;
  token_hash: string;
  expected_mime_type: string;
  expected_size: number;
  quarantine_r2_key: string;
  status: string;
  expires_at: number;
  consumed_at: number | null;
  created_at: number;
  updated_at: number;
};

export async function createUploadIntent(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  input: {
    filename?: string;
    mime_type?: string;
    file_size?: number;
    asset_type?: string;
    tags?: string[];
  },
  now = Date.now(),
) {
  const mimeType = String(input.mime_type || '').toLowerCase();
  const fileSize = Number(input.file_size || 0);
  if (!SUPPORTED_UPLOAD_MIME.has(mimeType)) {
    return { ok: false as const, status: 400, error: 'unsupported_mime_type' };
  }
  if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_UPLOAD_BYTES) {
    return { ok: false as const, status: 400, error: 'invalid_file_size' };
  }

  const assetId = generateId();
  const intentId = generateId();
  const rawToken = generateToken(32);
  const tokenHash = await hashToken(rawToken);
  const quarantineKey = `media-quarantine/${userId}/${assetId}/original`;
  const filename = sanitizeFilename(input.filename || 'upload');
  const assetType = normalizeAssetType(input.asset_type || 'image');
  const tags = normalizeTags(input.tags || []);
  const metadata = tags.length ? { tags } : {};

  await env.DB.prepare(`
    INSERT INTO media_assets (
      id, user_id, asset_type, source, r2_key, original_filename, mime_type,
      file_size, metadata_json, lifecycle_status, created_at, updated_at
    )
    VALUES (?, ?, ?, 'upload', ?, ?, ?, ?, ?, 'upload_pending', ?, ?)
  `).bind(
    assetId,
    userId,
    assetType,
    quarantineKey,
    filename,
    mimeType,
    fileSize,
    canonicalJson(metadata),
    now,
    now,
  ).run();

  await env.DB.prepare(`
    INSERT INTO media_upload_intents (
      id, user_id, asset_id, token_hash, expected_mime_type, expected_size,
      quarantine_r2_key, status, expires_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(
    intentId,
    userId,
    assetId,
    tokenHash,
    mimeType,
    fileSize,
    quarantineKey,
    now + UPLOAD_INTENT_TTL_MS,
    now,
    now,
  ).run();

  return {
    ok: true as const,
    intent: {
      intent_id: intentId,
      asset_id: assetId,
      upload_token: rawToken,
      upload_url: `/api/media/uploads/${intentId}`,
      expires_at: now + UPLOAD_INTENT_TTL_MS,
      max_bytes: MAX_UPLOAD_BYTES,
    },
  };
}

export async function putUploadBytes(
  env: Pick<Bindings, 'DB' | 'R2'>,
  userId: string,
  intentId: string,
  uploadToken: string,
  body: ArrayBuffer | ReadableStream<Uint8Array>,
  contentLength: number,
  contentType?: string | null,
  now = Date.now(),
) {
  const intent = await getUploadIntent(env, userId, intentId);
  if (!intent) return { ok: false as const, status: 404, error: 'upload_intent_not_found' };
  if (intent.status !== 'pending') return { ok: false as const, status: 409, error: 'upload_intent_already_used' };
  if (intent.expires_at <= now) return { ok: false as const, status: 410, error: 'upload_intent_expired' };
  if (await hashToken(uploadToken) !== intent.token_hash) {
    return { ok: false as const, status: 403, error: 'invalid_upload_token' };
  }
  if (contentLength !== intent.expected_size) {
    return { ok: false as const, status: 400, error: 'file_size_mismatch' };
  }
  if (contentType && contentType.split(';')[0].toLowerCase() !== intent.expected_mime_type) {
    return { ok: false as const, status: 400, error: 'mime_type_mismatch' };
  }

  const claimed = await env.DB.prepare(`
    UPDATE media_upload_intents
    SET status = 'uploading', consumed_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?
  `).bind(now, now, intentId, userId, now).run();
  if (claimed.meta.changes !== 1) {
    return { ok: false as const, status: 409, error: 'upload_intent_already_used' };
  }

  await env.R2.put(intent.quarantine_r2_key, body, {
    httpMetadata: { contentType: intent.expected_mime_type },
    customMetadata: {
      user_id: userId,
      asset_id: intent.asset_id,
      upload_intent_id: intent.id,
      quarantine: 'true',
    },
  });

  await env.DB.prepare(`
    UPDATE media_upload_intents SET status = 'uploaded', updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, intentId, userId).run();

  await enqueueMediaWorkItem(env, {
    work_type: 'validate_upload',
    dedupe_key: `validate_upload:${intent.asset_id}`,
    asset_id: intent.asset_id,
    payload: { asset_id: intent.asset_id, upload_intent_id: intent.id },
  }, now);

  return { ok: true as const, asset_id: intent.asset_id, status: 'uploaded' };
}

export async function finalizeUploadedAsset(
  env: Pick<Bindings, 'DB' | 'R2'>,
  userId: string,
  assetId: string,
  now = Date.now(),
) {
  const asset = await getAssetRow(env, userId, assetId);
  if (!asset) return { ok: false as const, status: 404, error: 'asset_not_found' };
  if (!['upload_pending', 'rejected'].includes(asset.lifecycle_status)) {
    return { ok: false as const, status: 409, error: 'asset_not_finalizable' };
  }

  const intent = await env.DB.prepare(`
    SELECT * FROM media_upload_intents
    WHERE asset_id = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(assetId, userId).first<UploadIntentRow>();
  if (!intent || intent.status !== 'uploaded') {
    return { ok: false as const, status: 409, error: 'upload_not_ready' };
  }

  const object = await env.R2.get(intent.quarantine_r2_key);
  if (!object) return { ok: false as const, status: 404, error: 'quarantine_object_not_found' };
  const bytes = new Uint8Array(await object.arrayBuffer());

  const quota = await checkStorageQuota(env, userId, bytes.byteLength);
  if (!quota.ok) {
    await markRejected(env, userId, assetId, intent, 'storage_quota_exceeded', now);
    await env.R2.delete(intent.quarantine_r2_key);
    return { ok: false as const, status: 413, error: 'storage_quota_exceeded', used: quota.used, quota: quota.quota };
  }

  if (isFontUpload(asset.asset_type, intent.expected_mime_type)) {
    const checksum = await sha256Hex(bytes);
    const extension = fontExtensionFromMime(intent.expected_mime_type, asset.original_filename);
    const canonicalKey = `media/${userId}/fonts/${assetId}/original.${extension}`;
    await env.R2.put(canonicalKey, bytes, {
      httpMetadata: { contentType: intent.expected_mime_type },
      customMetadata: {
        user_id: userId,
        asset_id: assetId,
        source: 'upload',
        checksum_sha256: checksum,
      },
    });
    await env.R2.delete(intent.quarantine_r2_key);

    const existingMetadata = parseJson(asset.metadata_json, {}) as Record<string, unknown>;
    await env.DB.prepare(`
      UPDATE media_assets
      SET r2_key = ?, mime_type = ?, file_size = ?, width = NULL, height = NULL,
          checksum_sha256 = ?, metadata_json = ?, lifecycle_status = 'active',
          updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      canonicalKey,
      intent.expected_mime_type,
      bytes.byteLength,
      checksum,
      canonicalJson({
        ...existingMetadata,
        font: {
          processor: 'worker_font_upload',
          extension,
          license_confirmed: false,
        },
      }),
      now,
      assetId,
      userId,
    ).run();
    await env.DB.prepare(`
      UPDATE media_upload_intents SET status = 'finalized', updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now, intent.id, userId).run();

    return { ok: true as const, asset: serializeAsset((await getAssetRow(env, userId, assetId))!) };
  }

  const inspection = inspectImageBytes(bytes, { maxBytes: MAX_UPLOAD_BYTES, maxMegapixels: 16 });
  if (!inspection.ok) {
    await env.DB.prepare(`
      UPDATE media_assets
      SET lifecycle_status = 'rejected', metadata_json = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(canonicalJson({ rejection: inspection }), now, assetId, userId).run();
    await env.DB.prepare(`
      UPDATE media_upload_intents SET status = 'rejected', updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now, intent.id, userId).run();
    await env.R2.delete(intent.quarantine_r2_key);
    return { ok: false as const, status: 400, error: inspection.error };
  }

  if (inspection.mimeType !== intent.expected_mime_type) {
    await markRejected(env, userId, assetId, intent, 'declared_mime_mismatch', now);
    return { ok: false as const, status: 400, error: 'declared_mime_mismatch' };
  }

  const checksum = await sha256Hex(bytes);
  const canonicalKey = `media/${userId}/inputs/${assetId}/original.${inspection.extension}`;
  await env.R2.put(canonicalKey, bytes, {
    httpMetadata: { contentType: inspection.mimeType },
    customMetadata: {
      user_id: userId,
      asset_id: assetId,
      source: 'upload',
      checksum_sha256: checksum,
    },
  });
  await env.R2.delete(intent.quarantine_r2_key);

  const metadata = {
    inspection: {
      kind: inspection.kind,
      megapixels: inspection.megapixels,
      processor: 'worker_first_pass_only',
      metadata_stripped: false,
      thumbnail_generated: false,
    },
  };
  await env.DB.prepare(`
    UPDATE media_assets
    SET r2_key = ?, mime_type = ?, file_size = ?, width = ?, height = ?,
        checksum_sha256 = ?, metadata_json = ?, lifecycle_status = 'active',
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(
    canonicalKey,
    inspection.mimeType,
    inspection.bytes,
    inspection.width,
    inspection.height,
    checksum,
    canonicalJson(metadata),
    now,
    assetId,
    userId,
  ).run();
  await env.DB.prepare(`
    UPDATE media_upload_intents SET status = 'finalized', updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, intent.id, userId).run();

  return { ok: true as const, asset: serializeAsset((await getAssetRow(env, userId, assetId))!) };
}

export async function listAssets(env: Pick<Bindings, 'DB'>, userId: string) {
  const result = await env.DB.prepare(`
    SELECT * FROM media_assets
    WHERE user_id = ? AND lifecycle_status != 'purged'
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(userId).all<MediaAssetRow>();
  return (result.results || []).map(serializeAsset);
}

export async function getAsset(env: Pick<Bindings, 'DB' | 'MEDIA_SIGNING_SECRET'>, userId: string, assetId: string, origin?: string) {
  const row = await getAssetRow(env, userId, assetId);
  if (!row) return null;
  const asset = serializeAsset(row);
  if (row.lifecycle_status === 'active' && origin) {
    const expiresAt = Date.now() + PROVIDER_URL_TTL_MS;
    const signature = await signMediaAssetUrl(env, {
      assetId: row.id,
      userId: row.user_id,
      purpose: 'provider_input',
      expiresAt,
    });
    asset.provider_url = `${origin}/api/media/provider-assets/${row.id}?${buildSignedMediaQuery({
      purpose: 'provider_input',
      expiresAt,
      signature,
    })}`;
  }
  return asset;
}

export async function getAssetRow(env: Pick<Bindings, 'DB'>, userId: string, assetId: string) {
  return env.DB.prepare('SELECT * FROM media_assets WHERE id = ? AND user_id = ?')
    .bind(assetId, userId).first<MediaAssetRow>();
}

export async function getAssetById(env: Pick<Bindings, 'DB'>, assetId: string) {
  return env.DB.prepare('SELECT * FROM media_assets WHERE id = ?')
    .bind(assetId).first<MediaAssetRow>();
}

export async function readAssetObject(env: Pick<Bindings, 'R2'>, asset: Pick<MediaAssetRow, 'r2_key'>) {
  return env.R2.get(asset.r2_key);
}

export async function patchAsset(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  assetId: string,
  input: { original_filename?: string; lifecycle_status?: string; asset_type?: string; tags?: string[] },
  now = Date.now(),
) {
  const asset = await getAssetRow(env, userId, assetId);
  if (!asset) return { ok: false as const, status: 404, error: 'asset_not_found' };

  const updates: string[] = [];
  const values: unknown[] = [];
  if (input.original_filename !== undefined) {
    updates.push('original_filename = ?');
    values.push(sanitizeFilename(input.original_filename));
  }
  if (input.lifecycle_status !== undefined) {
    if (!['active', 'archived'].includes(input.lifecycle_status)) {
      return { ok: false as const, status: 400, error: 'invalid_lifecycle_status' };
    }
    updates.push('lifecycle_status = ?');
    values.push(input.lifecycle_status);
    updates.push('archived_at = ?');
    values.push(input.lifecycle_status === 'archived' ? now : null);
    // Start the retention countdown the moment it's archived — the purge
    // sweep reclaims the R2 object once this passes. Restoring to 'active'
    // clears it, same as archived_at.
    updates.push('purge_after = ?');
    values.push(input.lifecycle_status === 'archived' ? now + ARCHIVED_ASSET_RETENTION_MS : null);
  }
  if (input.asset_type !== undefined) {
    updates.push('asset_type = ?');
    values.push(normalizeAssetType(input.asset_type));
  }
  if (input.tags !== undefined) {
    const metadata = parseJson(asset.metadata_json, {}) as Record<string, unknown>;
    updates.push('metadata_json = ?');
    values.push(canonicalJson({ ...metadata, tags: normalizeTags(input.tags) }));
  }
  if (!updates.length) return { ok: true as const, asset: serializeAsset(asset) };

  updates.push('updated_at = ?');
  values.push(now, assetId, userId);
  await env.DB.prepare(`UPDATE media_assets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...values).run();
  return { ok: true as const, asset: serializeAsset((await getAssetRow(env, userId, assetId))!) };
}

export async function favoriteAsset(env: Pick<Bindings, 'DB'>, userId: string, assetId: string, favorite: boolean, now = Date.now()) {
  const result = await env.DB.prepare(`
    UPDATE media_assets SET favorite = ?, updated_at = ?
    WHERE id = ? AND user_id = ? AND lifecycle_status != 'purged'
  `).bind(favorite ? 1 : 0, now, assetId, userId).run();
  if (result.meta.changes !== 1) return { ok: false as const, status: 404, error: 'asset_not_found' };
  return { ok: true as const, asset: serializeAsset((await getAssetRow(env, userId, assetId))!) };
}

export async function deleteAsset(env: Pick<Bindings, 'DB' | 'R2'>, userId: string, assetId: string, now = Date.now()) {
  const asset = await getAssetRow(env, userId, assetId);
  if (!asset || asset.lifecycle_status === 'purged') {
    return { ok: false as const, status: 404, error: 'asset_not_found' };
  }
  await env.R2.delete(asset.r2_key);
  if (asset.thumbnail_r2_key) await env.R2.delete(asset.thumbnail_r2_key);
  const result = await env.DB.prepare(`
    UPDATE media_assets
    SET lifecycle_status = 'purged', deleted_at = ?, purge_after = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, now, now, assetId, userId).run();
  if (result.meta.changes !== 1) return { ok: false as const, status: 404, error: 'asset_not_found' };
  return { ok: true as const };
}

export function serializeAsset(row: MediaAssetRow) {
  return {
    id: row.id,
    asset_type: row.asset_type,
    source: row.source,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    file_size: row.file_size,
    width: row.width,
    height: row.height,
    metadata: parseJson(row.metadata_json, {}),
    favorite: row.favorite === 1,
    lifecycle_status: row.lifecycle_status,
    checksum_sha256: row.checksum_sha256,
    created_at: row.created_at,
    updated_at: row.updated_at,
    provider_url: undefined as string | undefined,
  };
}

async function getUploadIntent(env: Pick<Bindings, 'DB'>, userId: string, intentId: string) {
  return env.DB.prepare('SELECT * FROM media_upload_intents WHERE id = ? AND user_id = ?')
    .bind(intentId, userId).first<UploadIntentRow>();
}

async function markRejected(
  env: Pick<Bindings, 'DB' | 'R2'>,
  userId: string,
  assetId: string,
  intent: UploadIntentRow,
  reason: string,
  now: number,
) {
  await env.DB.prepare(`
    UPDATE media_assets SET lifecycle_status = 'rejected', metadata_json = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(canonicalJson({ rejection: { error: reason } }), now, assetId, userId).run();
  await env.DB.prepare(`
    UPDATE media_upload_intents SET status = 'rejected', updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, intent.id, userId).run();
  await env.R2.delete(intent.quarantine_r2_key);
}

function normalizeAssetType(value: string) {
  return ['image', 'product', 'person', 'people', 'character', 'style', 'logo', 'template', 'font', 'mask', 'thumbnail'].includes(value) ? value : 'image';
}

function isFontUpload(assetType: string, mimeType: string) {
  return assetType === 'font' || mimeType.startsWith('font/') || mimeType.includes('font-');
}

function fontExtensionFromMime(mimeType: string, filename: string | null) {
  const fromName = (filename || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (fromName && ['ttf', 'otf', 'woff', 'woff2'].includes(fromName)) return fromName;
  if (mimeType.includes('woff2')) return 'woff2';
  if (mimeType.includes('woff')) return 'woff';
  if (mimeType.includes('otf')) return 'otf';
  return 'ttf';
}

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.\- ]+/g, '').trim().slice(0, 160) || 'upload';
}

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags
    .map((tag) => tag.replace(/[^\w\- ]+/g, '').trim().slice(0, 40))
    .filter(Boolean)))
    .slice(0, 12);
}

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
