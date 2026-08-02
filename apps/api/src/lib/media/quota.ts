import type { Bindings } from '../types';

// Ops-configurable via env.MEDIA_STORAGE_QUOTA_MB; falls back to this MVP
// default if unset. Not yet per-plan — revisit once real usage data exists.
export const DEFAULT_MEDIA_STORAGE_QUOTA_BYTES = 1_000 * 1024 * 1024; // 1000 MB per user

export function getMediaStorageQuotaBytes(env: Pick<Bindings, 'MEDIA_STORAGE_QUOTA_MB'>): number {
  const mb = Number((env as any).MEDIA_STORAGE_QUOTA_MB);
  return Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : DEFAULT_MEDIA_STORAGE_QUOTA_BYTES;
}

export async function getUserStorageUsageBytes(env: Pick<Bindings, 'DB'>, userId: string): Promise<number> {
  // Exclude 'purged' (R2 object already reclaimed) and 'rejected' (the
  // quarantine object was deleted at rejection time — see markRejected() in
  // assets.ts and the abandoned-upload-intent cleanup in purge.ts — so a
  // rejected row never holds any real R2 bytes even though its file_size
  // column still carries the original client-declared size).
  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(file_size), 0) as bytes FROM media_assets
    WHERE user_id = ? AND lifecycle_status NOT IN ('purged', 'rejected')
  `).bind(userId).first<{ bytes: number }>();
  return row?.bytes || 0;
}

export async function checkStorageQuota(
  env: Pick<Bindings, 'DB' | 'MEDIA_STORAGE_QUOTA_MB'>,
  userId: string,
  incomingBytes: number,
): Promise<{ ok: true } | { ok: false; used: number; quota: number }> {
  const quotaBytes = getMediaStorageQuotaBytes(env);
  const used = await getUserStorageUsageBytes(env, userId);
  if (used + incomingBytes > quotaBytes) {
    return { ok: false, used, quota: quotaBytes };
  }
  return { ok: true };
}
