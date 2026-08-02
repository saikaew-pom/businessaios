import type { AiModelRow } from '../catalog';

export type ResolvedProviderReference = {
  asset_id: string;
  mention_name: string;
  reference_role: string;
  provider_url: string;
};

export type ProviderGenerationInput = {
  generation_id: string;
  model: AiModelRow;
  prompt: string;
  options: Record<string, unknown>;
  references: ResolvedProviderReference[];
};

export type ProviderGenerationResult = {
  provider: string;
  provider_request_id: string | null;
  image_urls: string[];
  image_base64: string[];
  provider_cost_usd: number | null;
  raw_summary: Record<string, unknown>;
};

export type MediaProviderAdapter = {
  provider: string;
  submit(input: ProviderGenerationInput): Promise<ProviderGenerationResult>;
};
