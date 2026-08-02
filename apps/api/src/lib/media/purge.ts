import type { Bindings } from '../types';
import { canonicalJson } from './catalog';

const PURGE_BATCH_SIZE = 25;

/**
 * Periodic sweep, run alongside the media work processor on the same Cron
 * Trigger — reclaims R2 storage for assets past their retention window and
 * cleans up abandoned (never-finalized) upload quarantine objects.
 */
export async function sweepMediaPurge(env: Bindings, now = Date.now()) {
  const purgedAssets = await purgeArchivedAssets(env, now);
  const expiredIntents = await cleanupExpiredUploadIntents(env, now);
  return { purgedAssets, expiredIntents };
}

async function purgeArchivedAssets(env: Bindings, now: number) {
  const due = await env.DB.prepare(`
    SELECT id, user_id, r2_key, thumbnail_r2_key FROM media_assets
    WHERE lifecycle_status = 'archived' AND purge_after IS NOT NULL AND purge_after <= ?
    ORDER BY purge_after ASC LIMIT ?
  `).bind(now, PURGE_BATCH_SIZE).all<{ id: string; user_id: string; r2_key: string; thumbnail_r2_key: string | null }>();

  let purged = 0;
  for (const row of due.results || []) {
    await env.R2.delete(row.r2_key);
    if (row.thumbnail_r2_key) await env.R2.delete(row.thumbnail_r2_key);
    await env.DB.prepare(`
      UPDATE media_assets SET lifecycle_status = 'purged', deleted_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now, now, row.id, row.user_id).run();
    purged += 1;
  }
  return purged;
}

async function cleanupExpiredUploadIntents(env: Bindings, now: number) {
  const due = await env.DB.prepare(`
    SELECT id, user_id, asset_id, quarantine_r2_key FROM media_upload_intents
    WHERE status IN ('pending', 'uploading') AND expires_at <= ?
    ORDER BY expires_at ASC LIMIT ?
  `).bind(now, PURGE_BATCH_SIZE).all<{ id: string; user_id: string; asset_id: string; quarantine_r2_key: string }>();

  let cleaned = 0;
  for (const row of due.results || []) {
    await env.R2.delete(row.quarantine_r2_key);
    await env.DB.prepare(`
      UPDATE media_upload_intents SET status = 'expired', updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(now, row.id, row.user_id).run();
    // The quarantine object backing this asset is gone for good — release
    // its "phantom" storage-quota footprint too. Without this, the
    // media_assets row created at upload-intent time (still lifecycle_status
    // 'upload_pending', still carrying the client-declared file_size) would
    // sit there forever and keep counting against the user's quota
    // (checkStorageQuota / getUserStorageUsageBytes in quota.ts) even though
    // zero bytes were ever actually stored. Mirrors the terminal 'rejected'
    // state used everywhere else a quarantine object gets deleted without a
    // finalized asset (see markRejected in assets.ts), which quota.ts also
    // excludes from the usage sum.
    await env.DB.prepare(`
      UPDATE media_assets
      SET lifecycle_status = 'rejected', metadata_json = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND lifecycle_status = 'upload_pending'
    `).bind(canonicalJson({ rejection: { error: 'upload_intent_expired' } }), now, row.asset_id, row.user_id).run();
    cleaned += 1;
  }
  return cleaned;
}
