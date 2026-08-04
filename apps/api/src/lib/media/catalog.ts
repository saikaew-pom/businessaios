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
      // No `references` block: this entry's endpoint (fal-ai/flux/dev) is
      // FLUX's plain text-to-image endpoint and structurally cannot accept
      // an input image — reference support lives on the separate
      // fal-flux-dev-i2i entry below, pointed at the real image-to-image
      // endpoint. `maxReferenceImages` used to be declared here, but nothing
      // reads that field name (referenceResolver reads `references.min/max`)
      // and it fell back to 0/0, so the field was purely misleading — it
      // implied a capability that both the resolver and fal's actual
      // endpoint would have rejected.
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
    adapter_config_json: canonicalJson({ endpoint: 'fal.run', model: 'fal-ai/flux/dev', size_param: 'image_size' }),
    sort_order: 100,
  }, now, 1);

  // Models are seeded in maintenance mode until a platform API key exists for
  // their provider. But the "setting a key lifts maintenance" UPDATE in
  // adminRoutes only touches rows that existed when the key was saved — so a
  // model added to this catalog AFTER an admin already configured fal would
  // otherwise be born in maintenance with no obvious way to know why. Checking
  // the key here keeps newly-added models consistent with the provider's
  // already-configured state.
  let falKeyConfigured: { ok: number } | null = null;
  try {
    falKeyConfigured = await env.DB
      .prepare("SELECT 1 as ok FROM platform_provider_keys WHERE provider = 'fal' AND is_active = 1")
      .first<{ ok: number }>();
  } catch {
    falKeyConfigured = null;
  }
  const falSeedMaintenance: 0 | 1 = falKeyConfigured ? 0 : 1;

  // Additional fal-hosted models. Credit prices are derived from fal's published
  // per-image cost at the project's documented rate of 1 credit ≈ $0.001 cost
  // (see lib/packages.ts), rounded up — so a generation never costs more to
  // serve than it charges. provider_cost_usd_per_output records the real cost so
  // the admin panel's margin reporting stays honest; adjust both together there
  // (no deploy needed) if fal changes pricing.
  const falModels: Array<{
    id: string; providerModelId: string; displayName: string;
    credits: number; costUsd: number; maxOutputCount: number;
    aspectRatios: string[]; sizeParam: 'image_size' | 'aspect_ratio'; sortOrder: number;
  }> = [
    {
      id: 'fal-flux-schnell-t2i', providerModelId: 'fal-ai/flux/schnell', displayName: 'FLUX.1 [schnell] — เร็ว/ประหยัด (fal.ai)',
      credits: 3, costUsd: 0.003, maxOutputCount: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'], sizeParam: 'image_size', sortOrder: 101,
    },
    {
      id: 'fal-flux-pro-v11-t2i', providerModelId: 'fal-ai/flux-pro/v1.1', displayName: 'FLUX1.1 [pro] — คุณภาพสูง (fal.ai)',
      credits: 55, costUsd: 0.055, maxOutputCount: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'], sizeParam: 'image_size', sortOrder: 102,
    },
    {
      id: 'fal-recraft-v3-t2i', providerModelId: 'fal-ai/recraft/v3/text-to-image', displayName: 'Recraft V3 — กราฟิก/ภาพประกอบ (fal.ai)',
      credits: 40, costUsd: 0.04, maxOutputCount: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'], sizeParam: 'image_size', sortOrder: 103,
    },
    {
      id: 'fal-nano-banana-2-t2i', providerModelId: 'fal-ai/nano-banana-2', displayName: 'Nano Banana 2 (Google, fal.ai)',
      credits: 80, costUsd: 0.08, maxOutputCount: 4,
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
      sizeParam: 'aspect_ratio', sortOrder: 104,
    },
    {
      id: 'fal-nano-banana-pro-t2i', providerModelId: 'fal-ai/nano-banana-pro', displayName: 'Nano Banana 2 Pro (Google, fal.ai)',
      credits: 150, costUsd: 0.15, maxOutputCount: 4,
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
      sizeParam: 'aspect_ratio', sortOrder: 105,
    },
    {
      // fal bills GPT Image 2 by quality tier + resolution ($0.01 lowest → $0.41
      // at 4K/high). We never send a `quality` field, so fal's own default
      // applies; 210 credits is priced against the ~$0.21 mid/high 1K tier.
      // Re-check in the admin panel if that default or fal's tiering changes.
      id: 'fal-gpt-image-2-t2i', providerModelId: 'openai/gpt-image-2', displayName: 'GPT Image 2 (OpenAI, fal.ai)',
      credits: 210, costUsd: 0.21, maxOutputCount: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'], sizeParam: 'image_size', sortOrder: 106,
    },
  ];

  for (const model of falModels) {
    await upsertSeedModel(env, {
      id: model.id,
      provider: 'fal',
      provider_model_id: model.providerModelId,
      display_name: model.displayName,
      model_type: 'image',
      operation: 'text_to_image',
      capabilities_json: canonicalJson({
        aspectRatios: model.aspectRatios,
        outputFormats: ['url'],
        maxOutputCount: model.maxOutputCount,
        // No `references` block, same reasoning as fal-flux-dev-t2i above —
        // every one of these points at a plain text-to-image endpoint.
      }),
      pricing_json: canonicalJson({
        unit: 'credit',
        credits_per_output: model.credits,
        minimum_credits: model.credits,
        provider_cost_usd_per_output: model.costUsd,
        billing_unit: 'delivered_output',
      }),
      pricing_version: `${model.id}-2026-08-03-v1`,
      safety_config_json: canonicalJson({ policy: 'provider_default' }),
      adapter_config_json: canonicalJson({ endpoint: 'fal.run', model: model.providerModelId, size_param: model.sizeParam }),
      sort_order: model.sortOrder,
    }, now, falSeedMaintenance);
  }

  // Reference-capable siblings of the models above — each points at fal's
  // actual image-accepting endpoint (a genuinely different URL from the
  // text-to-image entries, not a flag on the same one), the way MiniMax's
  // subject-reference model is a separate catalog row from its plain
  // text-to-image one. Two request shapes exist across providers: Google
  // and OpenAI's edit endpoints take `image_urls` (a real array — multiple
  // reference images composited together), FLUX/Recraft's image-to-image
  // endpoints take a single `image_url` (one starting image transformed by
  // the prompt). `image_field` in adapter_config_json tells the fal adapter
  // which shape to send; see readImageField() in providers/fal.ts.
  //
  // Output sizing is a THIRD per-vendor split, verified against fal's live
  // OpenAPI schema for each endpoint (`fal.ai/api/openapi/queue/openapi.json
  // ?endpoint_id=...`) rather than assumed from the text-to-image sibling:
  // Google's edit endpoints take `aspect_ratio`, OpenAI's takes `image_size`
  // — same as their t2i siblings — but FLUX/Recraft's single-image
  // image-to-image endpoints have NO size field at all (no image_size, no
  // aspect_ratio, no width/height); they derive output dimensions entirely
  // from the input image. `sizeParam: 'none'` on those two tells the fal
  // adapter to send neither field rather than a value the endpoint would
  // silently ignore.
  const falImageToImageModels: Array<{
    id: string; providerModelId: string; displayName: string;
    credits: number; costUsd: number; maxOutputCount: number;
    aspectRatios: string[]; sizeParam: 'image_size' | 'aspect_ratio' | 'none';
    imageField: 'image_url' | 'image_urls'; maxReferences: number; sortOrder: number;
  }> = [
    {
      id: 'fal-flux-dev-i2i', providerModelId: 'fal-ai/flux/dev/image-to-image', displayName: 'FLUX.1 [dev] ปรับจากภาพอ้างอิง (fal.ai)',
      // $0.03/megapixel vs the t2i entry's $0.003 — image-to-image is a
      // materially different (10x pricier) endpoint on fal's side, not a
      // mode switch on the same one. aspectRatios stays populated (so the
      // shared aspect-ratio picker keeps working and pricing validation
      // doesn't reject a caller-supplied value) even though sizeParam:
      // 'none' means the choice isn't actually sent to fal — see the
      // capability_warnings note pushed for this id in createPricingQuote.
      credits: 30, costUsd: 0.03, maxOutputCount: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'], sizeParam: 'none',
      imageField: 'image_url', maxReferences: 1, sortOrder: 110,
    },
    {
      id: 'fal-recraft-v3-i2i', providerModelId: 'fal-ai/recraft/v3/image-to-image', displayName: 'Recraft V3 ปรับจากภาพอ้างอิง (fal.ai)',
      // Same sizeParam: 'none' reasoning as fal-flux-dev-i2i above — verified
      // against fal's OpenAPI schema, this endpoint's only fields are prompt,
      // image_url, strength, style, colors, style_id, negative_prompt,
      // sync_mode; there is no size/aspect_ratio/width/height field to send.
      credits: 40, costUsd: 0.04, maxOutputCount: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'], sizeParam: 'none',
      imageField: 'image_url', maxReferences: 1, sortOrder: 111,
    },
    {
      id: 'fal-nano-banana-2-i2i', providerModelId: 'fal-ai/nano-banana-2/edit', displayName: 'Nano Banana 2 ผสมภาพอ้างอิง (Google, fal.ai)',
      credits: 80, costUsd: 0.08, maxOutputCount: 4,
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
      sizeParam: 'aspect_ratio',
      // fal's own endpoint accepts up to 14 reference images; capped lower
      // here — this app's reference-attach UI (built for MiniMax's single
      // subject reference) hasn't been designed or tested against a large
      // gallery picker. Raise this once that UI exists.
      imageField: 'image_urls', maxReferences: 4, sortOrder: 112,
    },
    {
      id: 'fal-nano-banana-pro-i2i', providerModelId: 'fal-ai/nano-banana-pro/edit', displayName: 'Nano Banana 2 Pro ผสมภาพอ้างอิง (Google, fal.ai)',
      credits: 150, costUsd: 0.15, maxOutputCount: 4,
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
      sizeParam: 'aspect_ratio',
      imageField: 'image_urls', maxReferences: 4, sortOrder: 113,
    },
    {
      id: 'fal-gpt-image-2-i2i', providerModelId: 'openai/gpt-image-2/edit', displayName: 'GPT Image 2 แก้ไขจากภาพอ้างอิง (OpenAI, fal.ai)',
      // Priced the same as the t2i entry (same quality-tier uncertainty —
      // see the comment on fal-gpt-image-2-t2i above).
      credits: 210, costUsd: 0.21, maxOutputCount: 4,
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'], sizeParam: 'image_size',
      imageField: 'image_urls', maxReferences: 4, sortOrder: 114,
    },
  ];

  for (const model of falImageToImageModels) {
    await upsertSeedModel(env, {
      id: model.id,
      provider: 'fal',
      provider_model_id: model.providerModelId,
      display_name: model.displayName,
      model_type: 'image',
      operation: 'image_to_image',
      capabilities_json: canonicalJson({
        aspectRatios: model.aspectRatios,
        outputFormats: ['url'],
        maxOutputCount: model.maxOutputCount,
        references: { min: 1, max: model.maxReferences },
      }),
      pricing_json: canonicalJson({
        unit: 'credit',
        credits_per_output: model.credits,
        minimum_credits: model.credits,
        provider_cost_usd_per_output: model.costUsd,
        billing_unit: 'delivered_output',
      }),
      pricing_version: `${model.id}-2026-08-04-v1`,
      safety_config_json: canonicalJson({ policy: 'provider_default' }),
      adapter_config_json: canonicalJson({
        endpoint: 'fal.run', model: model.providerModelId,
        size_param: model.sizeParam, image_field: model.imageField,
      }),
      sort_order: model.sortOrder,
    }, now, falSeedMaintenance);
  }
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
  if (model.id === 'fal-flux-dev-i2i' || model.id === 'fal-recraft-v3-i2i') {
    warnings.push('This model has no output-size control on the fal side; the generated image follows the reference image dimensions regardless of the selected aspect ratio.');
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
