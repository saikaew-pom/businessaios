/**
 * Public config from API — exposes non-secret values (e.g. Turnstile site key)
 * Cached in memory + sessionStorage.
 */

import { PUBLIC_API_URL } from '$env/static/public';

export type PublicConfig = {
  turnstile: {
    site_key: string | null;
    required: boolean;
  };
  features: {
    email_verification: boolean;
    google_oauth: boolean;
  };
};

let cached: PublicConfig | null = null;
let fetchPromise: Promise<PublicConfig> | null = null;

export async function fetchConfig(): Promise<PublicConfig> {
  if (cached) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/config`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cached = data;
      return data;
    } catch {
      // Fallback: mock mode (no Turnstile, no email verification visible)
      const fallback: PublicConfig = {
        turnstile: { site_key: null, required: false },
        features: { email_verification: false, google_oauth: false },
      };
      cached = fallback;
      return fallback;
    } finally {
      fetchPromise = null;
    }
  })();
  return fetchPromise;
}
