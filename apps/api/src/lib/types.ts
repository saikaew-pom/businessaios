/**
 * Shared types for Business Smart OS API
 */

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  ALLOWED_ORIGIN: string;
  API_URL?: string;
  WEB_URL?: string;
  RESEND_FROM_EMAIL: string;
  NOTIFY_EMAIL: string;
  MINIMAX_MODEL: string;
  RESEND_API_KEY?: string;
  MINIMAX_API_KEY: string;
  MINIMAX_GROUP_ID: string;
  MEDIA_SIGNING_SECRET?: string;
  MEDIA_STORAGE_QUOTA_MB?: string;
  SESSION_SECRET?: string;
  MASTER_ENCRYPTION_KEY?: string;
  BREVO_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
  CREATIVE_STUDIO_ENABLED?: string;
  CREATIVE_EMBEDDED_ENABLED?: string;
  BRAND_CONTEXT_ENABLED?: string;
  BRAND_COMPOSITION_ENABLED?: string;
  SOCIAL_PUBLISHING_ENABLED?: string;
  SOCIAL_TOKEN_ENCRYPTION_KEY_VERSION?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

export type Variables = {
  requestId: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    plan: string;
  };
};

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
