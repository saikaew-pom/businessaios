import { describe, expect, it } from 'vitest';
import {
  buildMiniMaxImageRequest,
  miniMaxImageModelMatrix,
  parseMiniMaxImageResponse,
} from '../src/lib/minimaxImage';

describe('MiniMax image adapter', () => {
  it('builds a text-to-image request using provider schema', () => {
    expect(buildMiniMaxImageRequest({
      prompt: ' clean product photo ',
      aspectRatio: '16:9',
      responseFormat: 'url',
      count: 2,
      promptOptimizer: true,
    })).toEqual({
      model: 'image-01',
      prompt: 'clean product photo',
      aspect_ratio: '16:9',
      response_format: 'url',
      n: 2,
      prompt_optimizer: true,
    });
  });

  it('builds a subject-reference request without changing mention semantics', () => {
    expect(buildMiniMaxImageRequest({
      prompt: 'make @person look premium',
      subjectReferences: [{ type: 'character', image_file: 'https://assets.example/person.png' }],
    })).toEqual({
      model: 'image-01',
      prompt: 'make @person look premium',
      aspect_ratio: '1:1',
      response_format: 'url',
      n: 1,
      subject_reference: [{ type: 'character', image_file: 'https://assets.example/person.png' }],
    });
  });

  it('rejects product references until MiniMax supports them in the live API', () => {
    expect(() => buildMiniMaxImageRequest({
      prompt: 'make @product look premium',
      subjectReferences: [{ type: 'product', image_file: 'https://assets.example/product.png' }],
    })).toThrow('minimax_image_subject_reference_type_unsupported:product');
  });

  it('rejects invalid output counts before provider call', () => {
    expect(() => buildMiniMaxImageRequest({ prompt: 'x', count: 0 })).toThrow('minimax_image_count_out_of_range');
    expect(() => buildMiniMaxImageRequest({ prompt: 'x', count: 10 })).toThrow('minimax_image_count_out_of_range');
  });

  it('normalizes successful URL responses', () => {
    const request = buildMiniMaxImageRequest({ prompt: 'x' });
    const result = parseMiniMaxImageResponse(request, {
      id: 'provider-request-1',
      data: { image_urls: ['https://cdn.example/out.png'] },
      base_resp: { status_code: 0, status_msg: 'success' },
    });
    expect(result).toMatchObject({
      provider: 'minimax',
      providerRequestId: 'provider-request-1',
      model: 'image-01',
      imageUrls: ['https://cdn.example/out.png'],
      imageBase64: [],
    });
  });

  it('documents text-to-image and subject-reference catalog rows', () => {
    expect(miniMaxImageModelMatrix.map((row) => row.operation)).toEqual(['text_to_image', 'image_to_image']);
    expect(miniMaxImageModelMatrix[1].capabilities.references).toMatchObject({
      min: 1,
      max: 1,
      providerTypes: ['character'],
      disabledProviderTypes: ['product'],
    });
  });
});
