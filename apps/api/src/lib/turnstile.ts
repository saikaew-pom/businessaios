/**
 * Cloudflare Turnstile verification
 * https://developers.cloudflare.com/turnstile/
 *
 * Modes:
 *  - Mock (no TURNSTILE_SECRET): always returns true (dev convenience)
 *  - Mock-but-required (TURNSTILE_REQUIRED=false): secret set but allow dev mode
 *  - Production: TURNSTILE_SECRET + TURNSTILE_REQUIRED unset/true → verify with Cloudflare
 *
 * Frontend should include the Turnstile widget on login + register pages.
 */

import type { Bindings } from './types';

export type TurnstileResult = {
  ok: boolean;
  error?: string;
};

/**
 * Verify a Turnstile token. Returns ok=true in mock mode.
 */
export async function verifyTurnstile(
  env: Bindings,
  token: string | undefined | null
): Promise<TurnstileResult> {
  const secret = (env as any).TURNSTILE_SECRET;
  const required = (env as any).TURNSTILE_REQUIRED;

  // Mock mode: no secret OR explicitly disabled via TURNSTILE_REQUIRED=false
  if (!secret || required === 'false') {
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: 'missing_turnstile_token' };
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });

    if (!res.ok) {
      return { ok: false, error: `turnstile_${res.status}` };
    }

    const data = await res.json() as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      return { ok: false, error: data['error-codes']?.join(',') || 'verification_failed' };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
