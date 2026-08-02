import { generateId } from '../crypto';
import type { Bindings } from '../types';
import { canonicalJson } from './catalog';

export type MediaWorkType =
  | 'validate_upload'
  | 'cleanup_upload'
  | 'submit_generation'
  | 'reconcile_status'
  | 'ingest_output'
  | 'finalize_hold'
  | 'refund_hold'
  | 'purge_asset';

export type MediaWorkItemRow = {
  id: string;
  generation_id: string | null;
  asset_id: string | null;
  work_type: MediaWorkType;
  dedupe_key: string;
  status: 'pending' | 'leased' | 'completed' | 'failed' | 'dead_letter';
  available_at: number;
  lease_until: number | null;
  attempts: number;
  max_attempts: number;
  payload_json: string;
  last_error: string | null;
  created_at: number;
  updated_at: number;
};

export async function enqueueMediaWorkItem(
  env: Pick<Bindings, 'DB'>,
  input: {
    work_type: MediaWorkType;
    dedupe_key: string;
    generation_id?: string | null;
    asset_id?: string | null;
    available_at?: number;
    max_attempts?: number;
    payload?: Record<string, unknown>;
  },
  now = Date.now(),
) {
  const id = generateId();
  await env.DB.prepare(`
    INSERT INTO media_work_items (
      id, generation_id, asset_id, work_type, dedupe_key, status, available_at,
      lease_until, attempts, max_attempts, payload_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, 0, ?, ?, ?, ?)
    ON CONFLICT(dedupe_key) DO UPDATE SET
      available_at = MIN(media_work_items.available_at, excluded.available_at),
      updated_at = excluded.updated_at
  `).bind(
    id,
    input.generation_id || null,
    input.asset_id || null,
    input.work_type,
    input.dedupe_key,
    input.available_at || now,
    input.max_attempts || 5,
    canonicalJson(input.payload || {}),
    now,
    now,
  ).run();

  const row = await env.DB.prepare('SELECT * FROM media_work_items WHERE dedupe_key = ?')
    .bind(input.dedupe_key).first<MediaWorkItemRow>();
  return row!;
}

export async function claimMediaWorkItems(
  env: Pick<Bindings, 'DB'>,
  input: { limit?: number; leaseMs?: number } = {},
  now = Date.now(),
) {
  const limit = Math.max(1, Math.min(20, input.limit || 10));
  const leaseUntil = now + (input.leaseMs || 60_000);
  const rows = await env.DB.prepare(`
    SELECT * FROM media_work_items
    WHERE
      available_at <= ?
      AND (
        status = 'pending'
        OR (status = 'leased' AND lease_until IS NOT NULL AND lease_until <= ?)
      )
    ORDER BY available_at ASC, created_at ASC
    LIMIT ?
  `).bind(now, now, limit).all<MediaWorkItemRow>();

  const claimed: MediaWorkItemRow[] = [];
  for (const row of rows.results || []) {
    const result = await env.DB.prepare(`
      UPDATE media_work_items
      SET status = 'leased', lease_until = ?, attempts = attempts + 1, updated_at = ?
      WHERE id = ?
        AND available_at <= ?
        AND (
          status = 'pending'
          OR (status = 'leased' AND lease_until IS NOT NULL AND lease_until <= ?)
        )
    `).bind(leaseUntil, now, row.id, now, now).run();
    if (result.meta.changes === 1) {
      const updated = await env.DB.prepare('SELECT * FROM media_work_items WHERE id = ?')
        .bind(row.id).first<MediaWorkItemRow>();
      if (updated) claimed.push(updated);
    }
  }
  return claimed;
}

export async function completeMediaWorkItem(env: Pick<Bindings, 'DB'>, id: string, now = Date.now()) {
  const result = await env.DB.prepare(`
    UPDATE media_work_items
    SET status = 'completed', lease_until = NULL, updated_at = ?
    WHERE id = ? AND status = 'leased'
  `).bind(now, id).run();
  return result.meta.changes === 1;
}

export async function failMediaWorkItem(
  env: Pick<Bindings, 'DB'>,
  id: string,
  error: string,
  now = Date.now(),
) {
  const row = await env.DB.prepare('SELECT attempts, max_attempts FROM media_work_items WHERE id = ?')
    .bind(id).first<{ attempts: number; max_attempts: number }>();
  if (!row) return false;
  const dead = row.attempts >= row.max_attempts;
  const nextAvailableAt = now + retryDelayMs(row.attempts);
  const result = await env.DB.prepare(`
    UPDATE media_work_items
    SET status = ?, lease_until = NULL, available_at = ?, last_error = ?, updated_at = ?
    WHERE id = ? AND status = 'leased'
  `).bind(
    dead ? 'dead_letter' : 'pending',
    dead ? now : nextAvailableAt,
    sanitizeError(error),
    now,
    id,
  ).run();
  return result.meta.changes === 1;
}

export async function runMediaScheduledShell(env: Pick<Bindings, 'DB'>, now = Date.now()) {
  const claimed = await claimMediaWorkItems(env, { limit: 10, leaseMs: 60_000 }, now);
  return {
    claimed: claimed.length,
    leased_ids: claimed.map((item) => item.id),
  };
}

function retryDelayMs(attempts: number) {
  const base = Math.min(30 * 60_000, 2 ** Math.max(0, attempts - 1) * 15_000);
  const jitter = Math.floor(Math.random() * 5000);
  return base + jitter;
}

function sanitizeError(error: string) {
  return error.replace(/https?:\/\/\S+/g, '[url]').slice(0, 500);
}
