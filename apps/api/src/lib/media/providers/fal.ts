import type { MediaProviderAdapter, ProviderGenerationInput } from './types';

const FAL_ENDPOINT_BASE = 'https://fal.run';

export function createFalProvider(apiKey: string | null, fetchImpl: typeof fetch = fetch): MediaProviderAdapter {
  return {
    provider: 'fal',
    async submit(input: ProviderGenerationInput) {
      if (!apiKey) throw new Error('fal_not_configured');

      const firstReference = input.references[0];
      const body: Record<string, unknown> = {
        prompt: input.prompt,
        image_size: normalizeImageSize(input.options.aspect_ratio),
        num_images: normalizeCount(input.options.num_images ?? input.options.count),
      };
      if (firstReference) body.image_url = firstReference.provider_url;

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
