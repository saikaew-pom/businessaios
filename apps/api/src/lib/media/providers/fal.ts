import type { MediaProviderAdapter, ProviderGenerationInput } from './types';

const FAL_ENDPOINT_BASE = 'https://fal.run';

export function createFalProvider(apiKey: string | null, fetchImpl: typeof fetch = fetch): MediaProviderAdapter {
  return {
    provider: 'fal',
    async submit(input: ProviderGenerationInput) {
      if (!apiKey) throw new Error('fal_not_configured');

      const body: Record<string, unknown> = {
        prompt: input.prompt,
        num_images: normalizeCount(input.options.num_images ?? input.options.count),
      };

      // fal hosts models from several upstream vendors and they do NOT share
      // one request schema for output dimensions. FLUX (t2i) and GPT Image 2
      // take an `image_size` enum ('landscape_16_9'); Google's Nano Banana
      // family takes a raw `aspect_ratio` string ('16:9'). Sending the wrong
      // one is silently ignored by fal and you get a default-square image
      // back, so the per-model convention is declared in the catalog's
      // adapter_config_json rather than guessed from the model id.
      //
      // FLUX/Recraft's single-image image-to-image endpoints are a third
      // case: verified against fal's own OpenAPI schema, they have NEITHER
      // field — no image_size, no aspect_ratio, no width/height — output
      // dimensions are derived entirely from the input image. `size_param:
      // 'none'` on those catalog rows means send neither; sending `image_size`
      // there wouldn't error, it would just be a dead field the endpoint
      // ignores while the requester's aspect-ratio choice silently does
      // nothing (see the capability_warning pushed for those model ids).
      const sizeParam = readSizeParam(input.model.adapter_config_json);
      const ratio = typeof input.options.aspect_ratio === 'string' ? input.options.aspect_ratio : '1:1';
      if (sizeParam === 'aspect_ratio') {
        body.aspect_ratio = ratio;
      } else if (sizeParam === 'image_size') {
        body.image_size = normalizeImageSize(ratio);
      }

      // Same split-by-upstream-vendor problem as size, one level worse: this
      // isn't just a different field name, it's a different SHAPE. FLUX and
      // Recraft's image-to-image endpoints take one starting image as a bare
      // `image_url` string; Google and OpenAI's edit endpoints take a real
      // array (`image_urls`) of every reference to composite together. A
      // model with no `image_field` configured (every plain text-to-image
      // entry) sends neither field, which is correct: those endpoints don't
      // accept an input image at all, so there is nothing to send.
      const imageField = readImageField(input.model.adapter_config_json);
      if (imageField === 'image_urls' && input.references.length) {
        body.image_urls = input.references.map((reference) => reference.provider_url);
      } else if (imageField === 'image_url' && input.references[0]) {
        // `image_url` is a single-image field — a request with 2+ attached
        // references would silently use only the first and drop the rest.
        // That should be structurally impossible: validateReferencesForModel
        // rejects any reference count above the catalog row's declared max
        // before a generation is ever created, and every current image_url
        // catalog row caps max at 1. This is a hard stop rather than a
        // silent truncation so a future catalog edit that raises max above 1
        // for an image_url model fails loudly here instead of quietly
        // dropping the requester's other reference images.
        if (input.references.length > 1) {
          throw new Error(`fal_image_url_reference_overflow:${input.model.id}:${input.references.length}`);
        }
        body.image_url = input.references[0].provider_url;
      }

      const response = await fetchImpl(`${FAL_ENDPOINT_BASE}/${input.model.provider_model_id}`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`fal_invalid_json:${response.status}:${text.slice(0, 160)}`);
      }
      if (!response.ok) {
        throw new Error(`fal_http_error:${response.status}:${parsed?.detail || text.slice(0, 160)}`);
      }

      const images: Array<{ url?: string }> = Array.isArray(parsed?.images) ? parsed.images : [];
      const imageUrls = images.map((image) => image.url).filter((url): url is string => Boolean(url));
      if (!imageUrls.length) throw new Error('fal_empty_output');

      return {
        provider: 'fal',
        provider_request_id: parsed?.request_id || null,
        image_urls: imageUrls,
        image_base64: [],
        provider_cost_usd: null, // real per-model cost is admin-tracked once pricing is confirmed
        raw_summary: {
          model: input.model.provider_model_id,
          output_count: imageUrls.length,
          seed: parsed?.seed ?? null,
        },
      };
    },
  };
}

/**
 * Which request field (if any) this model wants its output dimensions in.
 * Defaults to 'image_size' so a catalog row that predates this field (or
 * omits it) keeps the original FLUX text-to-image behaviour instead of
 * silently sending nothing. `'none'` must be explicit in the catalog (see
 * the FLUX/Recraft image-to-image rows) — it is never the fallback, since a
 * missing/unrecognized value should keep the old default, not go quiet.
 */
function readSizeParam(adapterConfigJson: string): 'image_size' | 'aspect_ratio' | 'none' {
  try {
    const parsed = JSON.parse(adapterConfigJson || '{}');
    if (parsed?.size_param === 'aspect_ratio') return 'aspect_ratio';
    if (parsed?.size_param === 'none') return 'none';
    return 'image_size';
  } catch {
    return 'image_size';
  }
}

/**
 * Which request field (if any) this model accepts reference images in. `null`
 * for a model with no `image_field` configured — every text-to-image-only
 * catalog entry, where the endpoint has no image input to send to at all.
 */
function readImageField(adapterConfigJson: string): 'image_url' | 'image_urls' | null {
  try {
    const parsed = JSON.parse(adapterConfigJson || '{}');
    return parsed?.image_field === 'image_urls' || parsed?.image_field === 'image_url' ? parsed.image_field : null;
  } catch {
    return null;
  }
}

function normalizeImageSize(value: unknown): string {
  const ratio = typeof value === 'string' ? value : '1:1';
  const map: Record<string, string> = {
    '1:1': 'square',
    '4:3': 'landscape_4_3',
    '3:4': 'portrait_4_3',
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
  };
  return map[ratio] || 'square';
}

function normalizeCount(value: unknown) {
  const count = Number(value || 1);
  return Number.isInteger(count) && count > 0 ? count : 1;
}
