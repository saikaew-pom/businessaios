import { inspectImageBytes } from '../mediaImage';
import type { Bindings } from '../types';
import { getPlatformProviderKey } from './providerKeys';

// fal.ai's well-known public background-removal model (rembg). Reuses the
// same platform-key mechanism as the fal.ai generation adapter — admin pastes
// one fal key in /admin/creative and both features light up together.
const FAL_REMBG_MODEL = 'fal-ai/imageutils/rembg';

export type BackgroundRemovalResult =
  | { ok: true; bytes: Uint8Array; mimeType: string; extension: string }
  | { ok: false; status: number; error: string };

export async function removeBackgroundViaFal(
  env: Pick<Bindings, 'DB' | 'MASTER_ENCRYPTION_KEY'>,
  sourceImageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BackgroundRemovalResult> {
  const overrideFetch: typeof fetch = (env as any).__MEDIA_PROVIDER_FETCH || fetchImpl;
  const apiKey = await getPlatformProviderKey(env, 'fal');
  if (!apiKey) return { ok: false, status: 503, error: 'fal_not_configured' };

  const response = await overrideFetch(`https://fal.run/${FAL_REMBG_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: sourceImageUrl }),
  });
  const text = await response.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: `fal_invalid_json:${response.status}` };
  }
  if (!response.ok) {
    return { ok: false, status: 502, error: `fal_http_error:${response.status}:${parsed?.detail || text.slice(0, 160)}` };
  }

  const outputUrl: string | undefined = parsed?.image?.url;
  if (!outputUrl) return { ok: false, status: 502, error: 'fal_empty_output' };

  const imageRes = await overrideFetch(outputUrl);
  if (!imageRes.ok) return { ok: false, status: 502, error: `fal_output_fetch_failed:${imageRes.status}` };
  const bytes = new Uint8Array(await imageRes.arrayBuffer());

  const inspection = inspectImageBytes(bytes);
  if (!inspection.ok) return { ok: false, status: 422, error: `output_inspection_failed:${inspection.error}` };

  return { ok: true, bytes, mimeType: inspection.mimeType, extension: inspection.extension };
}
