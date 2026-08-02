/**
 * MiniMax image-generation adapter for Creative Studio provider spikes.
 *
 * Official API shape, as of 2026-08-01:
 *   POST https://api.minimax.io/v1/image_generation
 *
 * Keep this adapter provider-specific and side-effect-light. Phase 3 will wrap
 * it with durable jobs, credit holds, R2 ingestion, retries, and provider policy.
 */

const MINIMAX_IMAGE_ENDPOINT = 'https://api.minimax.io/v1/image_generation';
const DEFAULT_IMAGE_MODEL = 'image-01';

export type MiniMaxAspectRatio = '1:1' | '16:9' | '4:3' | '3:2' | '2:3' | '3:4' | '9:16' | '21:9';
export type MiniMaxResponseFormat = 'url' | 'base64';
export type MiniMaxSubjectReferenceType = 'character' | 'product';
const SUPPORTED_SUBJECT_REFERENCE_TYPES: MiniMaxSubjectReferenceType[] = ['character'];

export type MiniMaxSubjectReference = {
  type: MiniMaxSubjectReferenceType;
  image_file: string;
};

export type MiniMaxImageGenerateInput = {
  prompt: string;
  model?: string;
  aspectRatio?: MiniMaxAspectRatio;
  responseFormat?: MiniMaxResponseFormat;
  count?: number;
  promptOptimizer?: boolean;
  subjectReferences?: MiniMaxSubjectReference[];
};

export type MiniMaxImageApiRequest = {
  model: string;
  prompt: string;
  aspect_ratio: MiniMaxAspectRatio;
  response_format: MiniMaxResponseFormat;
  n: number;
  prompt_optimizer?: boolean;
  subject_reference?: MiniMaxSubjectReference[];
};

export type MiniMaxImageApiResponse = {
  id?: string;
  data?: {
    image_urls?: string[];
    image_base64?: string[];
    images?: string[];
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  [key: string]: unknown;
};

export type MiniMaxImageResult = {
  provider: 'minimax';
  providerRequestId: string | null;
  model: string;
  imageUrls: string[];
  imageBase64: string[];
  rawBaseResp: MiniMaxImageApiResponse['base_resp'] | null;
};

export function buildMiniMaxImageRequest(input: MiniMaxImageGenerateInput): MiniMaxImageApiRequest {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error('minimax_image_prompt_required');

  const count = input.count ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 9) {
    throw new Error('minimax_image_count_out_of_range');
  }

  const request: MiniMaxImageApiRequest = {
    model: input.model || DEFAULT_IMAGE_MODEL,
    prompt,
    aspect_ratio: input.aspectRatio || '1:1',
    response_format: input.responseFormat || 'url',
    n: count,
  };

  if (typeof input.promptOptimizer === 'boolean') {
    request.prompt_optimizer = input.promptOptimizer;
  }

  if (input.subjectReferences?.length) {
    request.subject_reference = input.subjectReferences.map((reference) => ({
      type: reference.type,
      image_file: reference.image_file,
    }));

    const unsupportedReference = request.subject_reference.find((reference) => (
      !SUPPORTED_SUBJECT_REFERENCE_TYPES.includes(reference.type)
    ));
    if (unsupportedReference) {
      throw new Error(`minimax_image_subject_reference_type_unsupported:${unsupportedReference.type}`);
    }
  }

  return request;
}

export function parseMiniMaxImageResponse(
  request: MiniMaxImageApiRequest,
  response: MiniMaxImageApiResponse,
): MiniMaxImageResult {
  const base = response.base_resp || null;
  if (base?.status_code && base.status_code !== 0) {
    throw new Error(`minimax_image_provider_error:${base.status_code}:${base.status_msg || 'unknown'}`);
  }

  const data = response.data || {};
  const imageUrls = Array.isArray(data.image_urls) ? data.image_urls.filter((url) => typeof url === 'string') : [];
  const imageBase64 = Array.isArray(data.image_base64)
    ? data.image_base64.filter((image) => typeof image === 'string')
    : Array.isArray(data.images)
      ? data.images.filter((image) => typeof image === 'string')
      : [];

  if (imageUrls.length === 0 && imageBase64.length === 0) {
    throw new Error('minimax_image_empty_output');
  }

  return {
    provider: 'minimax',
    providerRequestId: response.id || null,
    model: request.model,
    imageUrls,
    imageBase64,
    rawBaseResp: base,
  };
}

export async function generateMiniMaxImage(
  apiKey: string,
  input: MiniMaxImageGenerateInput,
  fetchImpl: typeof fetch = fetch,
): Promise<MiniMaxImageResult> {
  if (!apiKey) throw new Error('minimax_image_api_key_required');

  const request = buildMiniMaxImageRequest(input);
  const startedAt = Date.now();
  const response = await fetchImpl(MINIMAX_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const text = await response.text();
  let payload: MiniMaxImageApiResponse;
  try {
    payload = JSON.parse(text) as MiniMaxImageApiResponse;
  } catch {
    throw new Error(`minimax_image_invalid_json:${response.status}:${text.slice(0, 160)}`);
  }

  if (!response.ok) {
    const base = payload.base_resp;
    throw new Error(`minimax_image_http_error:${response.status}:${base?.status_msg || text.slice(0, 160)}`);
  }

  const result = parseMiniMaxImageResponse(request, payload);
  console.log('[MiniMaxImage]', {
    model: result.model,
    durationMs: Date.now() - startedAt,
    outputCount: result.imageUrls.length + result.imageBase64.length,
    responseFormat: request.response_format,
    baseStatus: result.rawBaseResp?.status_code ?? null,
  });
  return result;
}

export const miniMaxImageModelMatrix = [
  {
    id: 'minimax-image-01-t2i',
    provider: 'minimax',
    providerModelId: DEFAULT_IMAGE_MODEL,
    displayName: 'MiniMax Image-01 Text to Image',
    operation: 'text_to_image',
    capabilities: {
      aspectRatios: ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'],
      outputFormats: ['url', 'base64'],
      maxOutputCount: 9,
      references: { min: 0, max: 0 },
    },
  },
  {
    id: 'minimax-image-01-i2i-subject',
    provider: 'minimax',
    providerModelId: DEFAULT_IMAGE_MODEL,
    displayName: 'MiniMax Image-01 Subject Reference',
    operation: 'image_to_image',
    capabilities: {
      aspectRatios: ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'],
      outputFormats: ['url', 'base64'],
      maxOutputCount: 9,
      references: {
        min: 1,
        max: 1,
        roles: ['subject'],
        providerTypes: ['character'],
        disabledProviderTypes: ['product'],
      },
    },
  },
];
