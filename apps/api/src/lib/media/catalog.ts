import { generateId } from '../crypto';
import { miniMaxImageModelMatrix } from '../minimaxImage';
import type { Bindings } from '../types';

export type AiModelRow = {
  id: string;
  provider: string;
  provider_model_id: string;
  display_name: string;
  model_type: string;
  operation: string;
  capabilities_json: string;
  pricing_json: string;
  pricing_version: string;
  safety_config_json: string;
  adapter_config_json: string;
  config_version: number;
  is_active: number;
  is_maintenance: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

export type PricingQuoteRow = {
  id: string;
  user_id: string;
  model_id: string;
  request_hash: string;
  pricing_version: string;
  credits: number;
  pricing_snapshot_json: string;
  expires_at: number;
  consumed_generation_id: string | null;
  created_at: number;
};

export type PublicAiModel = {
  id: string;
  provider: string;
  display_name: string;
  model_type: string;
  operation: string;
  capabilities: Record<string, unknown>;
  pricing: Record<string, unknown>;
  pricing_version: string;
  config_version: number;
  is_maintenance: boolean;
};

export type PricingPreviewInput = {
  model_id: string;
  operation?: string;
  options?: {
    num_images?: number;
    count?: number;
    aspect_ratio?: string;
    response_format?: string;
    [key: string]: unknown;
  };
  reference_count?: number;
};

const QUOTE_TTL_MS = 10 * 60 * 1000;

export async function seedMediaModelCatalog(env: Pick<Bindings, 'DB'>, now = Date.now()) {
  const rows = miniMaxImageModelMatrix.map((model, index) => {
    const outputCredits = 2;
    return {
      id: model.id,
      provider: model.provider,
      provider_model_id: model.providerModelId,
      display_name: model.displayName,
      model_type: 'image',
      operation: model.operation,
      capabilities_json: canonicalJson(model.capabilities),
      pricing_json: canonicalJson({
        unit: 'credit',
        credits_per_output: outputCredits,
        minimum_credits: outputCredits,
        provider_cost_usd_per_output: 0.0035,
        billing_unit: 'delivered_output',
        release: '1A-beta',
      }),
      pricing_version: 'minimax-image-01-2026-08-01-beta-v1',
      safety_config_json: canonicalJson({ policy: 'provider_default' }),
      adapter_config_json: canonicalJson({
        endpoint: 'image_generation',
        model: model.providerModelId,
        live_api_notes: model.id.endsWith('i2i-subject')
          ? 'MiniMax live API currently accepts character subject_reference only.'
          : null,
      }),
      sort_order: index + 1,
    };
  });

  for (const row of rows) {
    await upsertSeedModel(env, row, now, 0);
  }

  // fal.ai — secondary/future provider (see docs/CREATIVE_STUDIO_PHASE_0B_MINIMAX_SPIKE.md).
  // Seeded in maintenance mode: no platform API key is configured until an admin
  // pastes one into the admin panel (POST /api/admin/creative/providers/fal/key),
  // which also lifts maintenance automatically.
  await upsertSeedModel(env, {
    id: 'fal-flux-dev-t2i',
    provider: 'fal',
    provider_model_id: 'fal-ai/flux/dev',
    display_name: 'Flux Dev (fal.ai)',
    model_type: 'image',
    operation: 'text_to_image',
    capabilities_json: canonicalJson({
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      outputFormats: ['url'],
      maxOutputCount: 4,
      maxReferenceImages: 1,
    }),
    pricing_json: canonicalJson({
      unit: 'credit',
      credits_per_output: 3,
      minimum_credits: 3,
      provider_cost_usd_per_output: null,
      billing_unit: 'delivered_output',
      release: 'secondary-provider-pending-config',
    }),
    pricing_version: 'fal-flux-dev-2026-08-02-v1',
    safety_config_json: canonicalJson({ policy: 'provider_default' }),
    adapter_config_json: canonicalJson({ endpoint: 'fal.run', model: 'fal-ai/flux/dev' }),
    sort_order: 100,
  }, now, 1);
}

async function upsertSeedModel(
  env: Pick<Bindings, 'DB'>,
  row: {
    id: string; provider: string; provider_model_id: string; display_name: string;
    model_type: string; operation: string; capabilities_json: string; pricing_json: string;
    pricing_version: string; safety_config_json: string; adapter_config_json: string; sort_order: number;
  },
  now: number,
  defaultIsMaintenance: 0 | 1,
) {
  await env.DB.prepare(`
    INSERT INTO ai_models (
      id, provider, provider_model_id, display_name, model_type, operation,
      capabilities_json, pricing_json, pricing_version, safety_config_json,
      adapter_config_json, config_version, is_active, is_maintenance,
      sort_order, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      capabilities_json = excluded.capabilities_json,
      pricing_json = excluded.pricing_json,
      pricing_version = excluded.pricing_version,
      safety_config_json = excluded.safety_config_json,
      adapter_config_json = excluded.adapter_config_json,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `).bind(
    row.id,
    row.provider,
    row.provider_model_id,
    row.display_name,
    row.model_type,
    row.operation,
    row.capabilities_json,
    row.pricing_json,
    row.pricing_version,
    row.safety_config_json,
    row.adapter_config_json,
    defaultIsMaintenance,
    row.sort_order,
    now,
    now,
  ).run();
}

export async function listActiveMediaModels(env: Pick<Bindings, 'DB'>): Promise<PublicAiModel[]> {
  await seedMediaModelCatalog(env);
  const result = await env.DB.prepare(`
    SELECT * FROM ai_models
    WHERE is_active = 1
    ORDER BY sort_order ASC, display_name ASC
  `).all<AiModelRow>();

  return (result.results || [])
    .map((row) => normalizeModel(row))
    .filter((model): model is PublicAiModel => Boolean(model))
    .filter((model) => !model.is_maintenance);
}

export async function getModelById(env: Pick<Bindings, 'DB'>, id: string): Promise<AiModelRow | null> {
  await seedMediaModelCatalog(env);
  return env.DB.prepare('SELECT * FROM ai_models WHERE id = ?').bind(id).first<AiModelRow>();
}

export async function createPricingQuote(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  input: PricingPreviewInput,
  now = Date.now(),
) {
  const model = await getModelById(env, input.model_id);
  if (!model || model.is_active !== 1) {
    return { ok: false as const, status: 404, error: 'model_not_found' };
  }

  const normalized = normalizeModel(model);
  if (!normalized || normalized.is_maintenance) {
    return { ok: false as const, status: 503, error: 'model_unavailable' };
  }

  if (input.operation && input.operation !== model.operation) {
    return { ok: false as const, status: 400, error: 'operation_mismatch' };
  }

  const warnings: string[] = [];
  const capabilities = normalized.capabilities as {
    aspectRatios?: string[];
    outputFormats?: string[];
    maxOutputCount?: number;
    references?: { min?: number; max?: number };
  };
  const pricing = normalized.pricing as {
    credits_per_output?: number;
    minimum_credits?: number;
    provider_cost_usd_per_output?: number;
  };
  const options = input.options || {};
  const outputCount = Math.max(1, Number(options.num_images ?? options.count ?? 1));

  if (!Number.isInteger(outputCount)) {
    return { ok: false as const, status: 400, error: 'invalid_output_count' };
  }
  if (outputCount > (capabilities.maxOutputCount || 1)) {
    return { ok: false as const, status: 400, error: 'output_count_not_supported' };
  }
  if (options.aspect_ratio && !capabilities.aspectRatios?.includes(String(options.aspect_ratio))) {
    return { ok: false as const, status: 400, error: 'aspect_ratio_not_supported' };
  }
  if (options.response_format && !capabilities.outputFormats?.includes(String(options.response_format))) {
    return { ok: false as const, status: 400, error: 'response_format_not_supported' };
  }

  const referenceCount = Number(input.reference_count || 0);
  const minReferences = capabilities.references?.min ?? 0;
  const maxReferences = capabilities.references?.max ?? 0;
  if (referenceCount < minReferences || referenceCount > maxReferences) {
    return { ok: false as const, status: 400, error: 'reference_count_not_supported' };
  }
  if (model.id === 'minimax-image-01-i2i-subject') {
    warnings.push('MiniMax Image-01 subject reference currently supports character reference only.');
  }

  const creditsPerOutput = Math.max(1, Number(pricing.credits_per_output || 1));
  const credits = Math.max(Number(pricing.minimum_credits || 1), creditsPerOutput * outputCount);
  const pricingOptions = {
    aspect_ratio: typeof options.aspect_ratio === 'string' ? options.aspect_ratio : '1:1',
    response_format: options.response_format === 'base64' ? 'base64' : 'url',
    num_images: outputCount,
  };
  const requestShape = buildPricingRequestShape({
    model_id: input.model_id,
    operation: model.operation,
    options: pricingOptions,
    reference_count: referenceCount,
  });
  const requestHash = await computePricingRequestHash(requestShape);
  const quoteId = generateId();
  const snapshot = {
    model_id: model.id,
    provider: model.provider,
    provider_model_id: model.provider_model_id,
    operation: model.operation,
    pricing_version: model.pricing_version,
    credits,
    output_count: outputCount,
    provider_cost_usd_estimate: Number(pricing.provider_cost_usd_per_output || 0) * outputCount,
    request_shape: requestShape,
  };

  await env.DB.prepare(`
    INSERT INTO media_pricing_quotes (
      id, user_id, model_id, request_hash, pricing_version, credits,
      pricing_snapshot_json, expires_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    quoteId,
    userId,
    model.id,
    requestHash,
    model.pricing_version,
    credits,
    canonicalJson(snapshot),
    now + QUOTE_TTL_MS,
    now,
  ).run();

  return {
    ok: true as const,
    quote: {
      quote_id: quoteId,
      model_id: model.id,
      credits,
      currency_note: 'credits',
      capability_warnings: warnings,
      pricing_version: model.pricing_version,
      request_hash: requestHash,
      expires_at: now + QUOTE_TTL_MS,
    },
  };
}

export async function getPricingQuote(env: Pick<Bindings, 'DB'>, userId: string, quoteId: string) {
  return env.DB.prepare('SELECT * FROM media_pricing_quotes WHERE id = ? AND user_id = ?')
    .bind(quoteId, userId).first<PricingQuoteRow>();
}

export function buildPricingRequestShape(input: {
  model_id: string;
  operation: string;
  options?: Record<string, unknown>;
  reference_count?: number;
}) {
  return {
    model_id: input.model_id,
    operation: input.operation,
    options: normalizeOptions(input.options || {}),
    reference_count: Number(input.reference_count || 0),
  };
}

export function computePricingRequestHash(requestShape: unknown) {
  return sha256Hex(canonicalJson(requestShape));
}

export function normalizeModel(row: AiModelRow): PublicAiModel | null {
  const capabilities = parseJsonObject(row.capabilities_json);
  const pricing = parseJsonObject(row.pricing_json);
  const safety = parseJsonObject(row.safety_config_json);
  const adapter = parseJsonObject(row.adapter_config_json);
  if (!capabilities || !pricing || !safety || !adapter) return null;
  if (typeof pricing.credits_per_output !== 'number' || pricing.credits_per_output < 1) return null;
  if (!Array.isArray(capabilities.outputFormats) || !Array.isArray(capabilities.aspectRatios)) return null;
  if (typeof capabilities.maxOutputCount !== 'number' || capabilities.maxOutputCount < 1) return null;

  return {
    id: row.id,
    provider: row.provider,
    display_name: row.display_name,
    model_type: row.model_type,
    operation: row.operation,
    capabilities,
    pricing,
    pricing_version: row.pricing_version,
    config_version: row.config_version,
    is_maintenance: row.is_maintenance === 1,
  };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function normalizeOptions(options: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null && value !== '') normalized[key] = value;
  }
  return sortJson(normalized);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortJson(nested)]),
    );
  }
  return value;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
