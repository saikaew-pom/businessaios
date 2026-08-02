import { generateId } from '../crypto';
import type { Bindings } from '../types';
import {
  buildPricingRequestShape,
  canonicalJson,
  computePricingRequestHash,
  getModelById,
  getPricingQuote,
  normalizeModel,
} from './catalog';
import { reserveMediaCredits } from './credits';
import { getAssetById, serializeAsset, type MediaAssetRow } from './assets';
import { validateReferencesForModel, type ReferenceInput } from './referenceResolver';
import { enqueueMediaWorkItem } from './workItems';
import { createBrandContextSnapshot } from '../creative/brandContext';

const ACTIVE_JOB_LIMIT = 3;
const DAILY_MEDIA_CREDIT_LIMIT = 500;
const HOLD_TTL_MS = 60 * 60 * 1000;
const DELIVERY_DEADLINE_MS = 30 * 60 * 1000;

export type MediaGenerationRow = {
  id: string;
  user_id: string;
  model_id: string;
  client_idempotency_key: string;
  request_hash: string;
  quote_id: string;
  creative_request_id: string | null;
  current_attempt_id: string | null;
  operation: string;
  prompt: string;
  resolved_prompt: string | null;
  options_json: string;
  status: string;
  submission_state: string;
  delivery_status: string;
  estimated_credits: number;
  final_credits: number | null;
  pricing_version: string;
  pricing_snapshot_json: string;
  expected_output_count: number;
  delivered_output_count: number;
  error_code: string | null;
  error_message: string | null;
  brand_profile_id: string | null;
  brand_snapshot_id: string | null;
  next_poll_at: number | null;
  last_polled_at: number | null;
  poll_attempts: number;
  lease_until: number | null;
  delivery_deadline_at: number | null;
  cancel_requested_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
};

export async function createMediaGeneration(
  env: Bindings,
  userId: string,
  idempotencyKey: string,
  input: {
    model_id?: string;
    prompt?: string;
    options?: Record<string, unknown>;
    references?: ReferenceInput[];
    quote_id?: string;
    expected_pricing_version?: string;
    brand_profile_id?: string | null;
    creative_request_id?: string | null;
  },
  now = Date.now(),
) {
  const normalizedIdempotencyKey = idempotencyKey.trim();
  if (!normalizedIdempotencyKey) return { ok: false as const, status: 400, error: 'idempotency_key_required' };
  if (!input.model_id || !input.quote_id || !input.prompt?.trim()) {
    return { ok: false as const, status: 400, error: 'missing_generation_fields' };
  }

  const model = await getModelById(env, input.model_id);
  const publicModel = model ? normalizeModel(model) : null;
  if (!model || !publicModel || model.is_active !== 1 || model.is_maintenance === 1) {
    return { ok: false as const, status: 404, error: 'model_not_found' };
  }

  const referenceValidation = await validateReferencesForModel(env, userId, {
    model_id: model.id,
    prompt: input.prompt,
    references: input.references || [],
  });
  if (!referenceValidation.ok) return referenceValidation;

  const options = normalizeGenerationOptions(input.options || {});
  const outputCount = Number(options.num_images || 1);
  const pricingOptions = {
    aspect_ratio: options.aspect_ratio,
    response_format: options.response_format,
    num_images: options.num_images,
  };
  const pricingShape = buildPricingRequestShape({
    model_id: model.id,
    operation: model.operation,
    options: pricingOptions,
    reference_count: referenceValidation.resolved.references.length,
  });
  const pricingHash = await computePricingRequestHash(pricingShape);
  const quote = await getPricingQuote(env, userId, input.quote_id);
  if (!quote || quote.model_id !== model.id) {
    return { ok: false as const, status: 409, error: 'quote_invalid' };
  }
  if (quote.expires_at <= now || quote.request_hash !== pricingHash || quote.pricing_version !== input.expected_pricing_version) {
    return { ok: false as const, status: 409, error: 'price_changed' };
  }

  const requestHash = await computeGenerationRequestHash({
    model_id: model.id,
    prompt: input.prompt.trim(),
    options,
    references: referenceValidation.resolved.references,
    quote_id: quote.id,
    pricing_version: quote.pricing_version,
  });
  const existing = await getGenerationByIdempotencyKey(env, userId, normalizedIdempotencyKey);
  if (existing) {
    if (existing.request_hash !== requestHash) return { ok: false as const, status: 409, error: 'idempotency_conflict' };
    if (quote.consumed_generation_id && quote.consumed_generation_id !== existing.id) {
      return { ok: false as const, status: 409, error: 'quote_invalid' };
    }
    return { ok: true as const, generation: await serializeGeneration(env, existing), idempotent: true };
  }
  if (quote.consumed_generation_id) {
    return { ok: false as const, status: 409, error: 'quote_invalid' };
  }

  const active = await countActiveGenerations(env, userId);
  if (active >= ACTIVE_JOB_LIMIT) return { ok: false as const, status: 429, error: 'active_job_limit_reached' };
  const dailyReserved = await getDailyReservedCredits(env, userId, now);
  if (dailyReserved + quote.credits > DAILY_MEDIA_CREDIT_LIMIT) {
    return { ok: false as const, status: 429, error: 'daily_media_credit_limit_reached' };
  }

  const generationId = generateId();
  const snapshot = await createBrandContextSnapshot(env, userId, input.brand_profile_id || null, now);
  const pricingSnapshot = parseJson(quote.pricing_snapshot_json, {});

  await env.DB.prepare(`
    INSERT INTO media_generations (
      id, user_id, model_id, client_idempotency_key, request_hash, quote_id,
      creative_request_id, operation, prompt, options_json, status,
      submission_state, delivery_status, estimated_credits, pricing_version,
      pricing_snapshot_json, expected_output_count, delivered_output_count,
      brand_profile_id, brand_snapshot_id, delivery_deadline_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'pending', 'pending',
      ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).bind(
    generationId,
    userId,
    model.id,
    normalizedIdempotencyKey,
    requestHash,
    quote.id,
    input.creative_request_id || null,
    model.operation,
    input.prompt.trim(),
    canonicalJson(options),
    quote.credits,
    quote.pricing_version,
    canonicalJson(pricingSnapshot),
    outputCount,
    snapshot.brand_profile_id,
    snapshot.id,
    now + DELIVERY_DEADLINE_MS,
    now,
    now,
  ).run();

  for (const reference of referenceValidation.resolved.references) {
    await env.DB.prepare(`
      INSERT INTO generation_references (
        id, generation_id, asset_id, mention_name, reference_role,
        influence_level, sort_order, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      generationId,
      reference.asset_id,
      reference.mention_name,
      reference.reference_role,
      reference.influence_level,
      reference.sort_order,
      now,
    ).run();
  }

  const reserved = await reserveMediaCredits(env, userId, generationId, quote.credits, now + HOLD_TTL_MS, now);
  if (!reserved.ok) {
    await markGenerationFailed(env, generationId, 'insufficient_credits', 'Credit balance is not enough for this generation.', now);
    return { ok: false as const, status: 402, error: reserved.error, balance: reserved.balance };
  }

  await env.DB.prepare('UPDATE media_pricing_quotes SET consumed_generation_id = ? WHERE id = ? AND user_id = ?')
    .bind(generationId, quote.id, userId).run();
  await enqueueMediaWorkItem(env, {
    work_type: 'submit_generation',
    dedupe_key: `submit_generation:${generationId}`,
    generation_id: generationId,
    payload: { generation_id: generationId },
  }, now);

  return {
    ok: true as const,
    generation: await serializeGeneration(env, (await getGeneration(env, userId, generationId))!),
    credits_remaining: reserved.balance,
  };
}

export async function listGenerations(env: Pick<Bindings, 'DB'>, userId: string) {
  const result = await env.DB.prepare(`
    SELECT * FROM media_generations
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(userId).all<MediaGenerationRow>();
  return Promise.all((result.results || []).map((row) => serializeGeneration(env, row)));
}

export async function getGeneration(env: Pick<Bindings, 'DB'>, userId: string, generationId: string) {
  return env.DB.prepare('SELECT * FROM media_generations WHERE id = ? AND user_id = ?')
    .bind(generationId, userId).first<MediaGenerationRow>();
}

export async function getGenerationById(env: Pick<Bindings, 'DB'>, generationId: string) {
  return env.DB.prepare('SELECT * FROM media_generations WHERE id = ?')
    .bind(generationId).first<MediaGenerationRow>();
}

export async function serializeGeneration(env: Pick<Bindings, 'DB'>, row: MediaGenerationRow) {
  const assets = await env.DB.prepare(`
    SELECT * FROM media_assets
    WHERE generation_id = ? AND lifecycle_status = 'active'
    ORDER BY created_at ASC
  `).bind(row.id).all<MediaAssetRow>();

  return {
    id: row.id,
    model_id: row.model_id,
    operation: row.operation,
    prompt: row.prompt,
    options: parseJson(row.options_json, {}),
    status: row.status,
    submission_state: row.submission_state,
    delivery_status: row.delivery_status,
    estimated_credits: row.estimated_credits,
    final_credits: row.final_credits,
    pricing_version: row.pricing_version,
    expected_output_count: row.expected_output_count,
    delivered_output_count: row.delivered_output_count,
    error_code: row.error_code,
    error_message: row.error_message,
    brand_profile_id: row.brand_profile_id,
    brand_snapshot_id: row.brand_snapshot_id,
    outputs: (assets.results || []).map(serializeAsset),
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  };
}

export async function markGenerationFailed(
  env: Pick<Bindings, 'DB'>,
  generationId: string,
  errorCode: string,
  errorMessage: string,
  now = Date.now(),
) {
  await env.DB.prepare(`
    UPDATE media_generations
    SET status = 'failed', delivery_status = 'permanently_failed',
        error_code = ?, error_message = ?, completed_at = ?, updated_at = ?
    WHERE id = ? AND status NOT IN ('completed', 'cancelled')
  `).bind(errorCode, errorMessage, now, now, generationId).run();
}

export async function markGenerationCompleted(
  env: Pick<Bindings, 'DB'>,
  generationId: string,
  deliveredOutputCount: number,
  finalCredits: number,
  now = Date.now(),
) {
  await env.DB.prepare(`
    UPDATE media_generations
    SET status = 'completed', delivery_status = 'available',
        delivered_output_count = ?, final_credits = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(deliveredOutputCount, finalCredits, now, now, generationId).run();
}

export async function requestCancelGeneration(env: Bindings, userId: string, generationId: string, now = Date.now()) {
  const generation = await getGeneration(env, userId, generationId);
  if (!generation) return { ok: false as const, status: 404, error: 'generation_not_found' };
  if (['completed', 'failed', 'cancelled'].includes(generation.status)) {
    return { ok: true as const, generation: await serializeGeneration(env, generation), terminal: true };
  }
  await env.DB.prepare(`
    UPDATE media_generations
    SET status = 'cancel_requested', cancel_requested_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(now, now, generationId, userId).run();
  return { ok: true as const, generation: await serializeGeneration(env, (await getGeneration(env, userId, generationId))!) };
}

async function getGenerationByIdempotencyKey(env: Pick<Bindings, 'DB'>, userId: string, key: string) {
  return env.DB.prepare('SELECT * FROM media_generations WHERE user_id = ? AND client_idempotency_key = ?')
    .bind(userId, key).first<MediaGenerationRow>();
}

async function countActiveGenerations(env: Pick<Bindings, 'DB'>, userId: string) {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM media_generations
    WHERE user_id = ? AND status IN ('queued', 'submitting', 'processing', 'delivery_pending')
  `).bind(userId).first<{ count: number }>();
  return row?.count || 0;
}

async function getDailyReservedCredits(env: Pick<Bindings, 'DB'>, userId: string, now: number) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(reserved_credits), 0) as credits
    FROM media_credit_holds
    WHERE user_id = ? AND created_at >= ?
  `).bind(userId, start.getTime()).first<{ credits: number }>();
  return row?.credits || 0;
}

function normalizeGenerationOptions(options: Record<string, unknown>) {
  return {
    aspect_ratio: typeof options.aspect_ratio === 'string' ? options.aspect_ratio : '1:1',
    response_format: options.response_format === 'base64' ? 'base64' : 'url',
    num_images: Number.isInteger(Number(options.num_images ?? options.count ?? 1))
      ? Number(options.num_images ?? options.count ?? 1)
      : 1,
    prompt_optimizer: options.prompt_optimizer !== false,
  };
}

async function computeGenerationRequestHash(value: unknown) {
  return computePricingRequestHash(value);
}

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
