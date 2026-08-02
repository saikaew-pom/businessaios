import type { Bindings } from '../types';

export type SignedMediaPurpose = 'provider_input' | 'download';

export async function signMediaAssetUrl(
  env: Pick<Bindings, 'MEDIA_SIGNING_SECRET'>,
  input: {
    assetId: string;
    userId: string;
    purpose: SignedMediaPurpose;
    expiresAt: number;
  },
) {
  const payload = mediaSigningPayload(input);
  return hmacHex(getMediaSigningSecret(env), payload);
}

export async function verifyMediaAssetSignature(
  env: Pick<Bindings, 'MEDIA_SIGNING_SECRET'>,
  input: {
    assetId: string;
    userId: string;
    purpose: SignedMediaPurpose;
    expiresAt: number;
    signature: string;
  },
  now = Date.now(),
) {
  if (!input.signature || !Number.isFinite(input.expiresAt) || input.expiresAt <= now) return false;
  const expected = await signMediaAssetUrl(env, input);
  return timingSafeEqual(input.signature, expected);
}

export function buildSignedMediaQuery(input: {
  purpose: SignedMediaPurpose;
  expiresAt: number;
  signature: string;
}) {
  const params = new URLSearchParams({
    purpose: input.purpose,
    exp: String(input.expiresAt),
    sig: input.signature,
  });
  return params.toString();
}

function mediaSigningPayload(input: {
  assetId: string;
  userId: string;
  purpose: SignedMediaPurpose;
  expiresAt: number;
}) {
  return `media:${input.assetId}:${input.userId}:${input.purpose}:${input.expiresAt}`;
}

function getMediaSigningSecret(env: Pick<Bindings, 'MEDIA_SIGNING_SECRET'>) {
  return env.MEDIA_SIGNING_SECRET || 'local-media-signing-dev-secret';
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
