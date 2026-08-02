import type { Bindings } from '../../types';
import { getPlatformProviderKey } from '../providerKeys';
import type { MediaProviderAdapter } from './types';
import { createMiniMaxProvider } from './minimax';
import { createFalProvider } from './fal';

export async function getMediaProvider(
  env: Pick<Bindings, 'MINIMAX_API_KEY' | 'DB' | 'MASTER_ENCRYPTION_KEY'>,
  provider: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MediaProviderAdapter> {
  const overrideFetch = (env as any).__MEDIA_PROVIDER_FETCH || fetchImpl;
  if (provider === 'minimax') {
    return createMiniMaxProvider(env.MINIMAX_API_KEY, overrideFetch);
  }
  if (provider === 'fal') {
    const apiKey = await getPlatformProviderKey(env, 'fal');
    return createFalProvider(apiKey, overrideFetch);
  }
  throw new Error(`media_provider_not_supported:${provider}`);
}
