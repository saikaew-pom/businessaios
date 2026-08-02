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
    creative_studio: boolean;
    brand_context: boolean;
    creative_embedded: boolean;
    brand_composition: boolean;
    social_publishing: boolean;
    content_series: boolean;
  };
  security: {
    csrf_token: string | null;
  };
};

let cached: PublicConfig | null = null;
let fetchPromise: Promise<PublicConfig> | null = null;

export async function fetchConfig(refresh = false): Promise<PublicConfig> {
  if (cached && !refresh) return cached;
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
        features: {
          email_verification: false,
          google_oauth: false,
          creative_studio: false,
          brand_context: false,
          creative_embedded: false,
          brand_composition: false,
          social_publishing: false,
          content_series: false,
        },
        security: { csrf_token: null },
      };
      cached = fallback;
      return fallback;
    } finally {
      fetchPromise = null;
    }
  })();
  return fetchPromise;
}

export async function getCsrfToken(): Promise<string | null> {
  if (cached?.security.csrf_token) return cached.security.csrf_token;
  const config = await fetchConfig(true);
  return config.security.csrf_token;
}
