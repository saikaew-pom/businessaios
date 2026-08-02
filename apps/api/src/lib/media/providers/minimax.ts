import { generateMiniMaxImage, type MiniMaxAspectRatio, type MiniMaxResponseFormat } from '../../minimaxImage';
import type { MediaProviderAdapter, ProviderGenerationInput } from './types';

export function createMiniMaxProvider(apiKey: string, fetchImpl: typeof fetch = fetch): MediaProviderAdapter {
  return {
    provider: 'minimax',
    async submit(input: ProviderGenerationInput) {
      const firstReference = input.references[0];
      const result = await generateMiniMaxImage(apiKey, {
        prompt: input.prompt,
        model: input.model.provider_model_id,
        aspectRatio: normalizeAspectRatio(input.options.aspect_ratio),
        responseFormat: normalizeResponseFormat(input.options.response_format),
        count: normalizeCount(input.options.num_images ?? input.options.count),
        promptOptimizer: input.options.prompt_optimizer !== false,
        subjectReferences: firstReference ? [{
          type: 'character',
          image_file: firstReference.provider_url,
        }] : undefined,
      }, fetchImpl);

      const outputCount = result.imageUrls.length + result.imageBase64.length;
      return {
        provider: 'minimax',
        provider_request_id: result.providerRequestId,
        image_urls: result.imageUrls,
        image_base64: result.imageBase64,
        provider_cost_usd: outputCount ? outputCount * 0.0035 : null,
        raw_summary: {
          base_resp: result.rawBaseResp,
          output_count: outputCount,
          response_format: result.imageUrls.length ? 'url' : 'base64',
        },
      };
    },
  };
}

function normalizeAspectRatio(value: unknown): MiniMaxAspectRatio {
  return typeof value === 'string' ? value as MiniMaxAspectRatio : '1:1';
}

function normalizeResponseFormat(value: unknown): MiniMaxResponseFormat {
  return value === 'base64' ? 'base64' : 'url';
}

function normalizeCount(value: unknown) {
  const count = Number(value || 1);
  return Number.isInteger(count) ? count : 1;
}
