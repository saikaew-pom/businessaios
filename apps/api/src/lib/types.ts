/**
 * Shared types for Business Smart OS API
 */

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  ALLOWED_ORIGIN: string;
  RESEND_FROM_EMAIL: string;
  NOTIFY_EMAIL: string;
  MINIMAX_MODEL: string;
  RESEND_API_KEY?: string;
  MINIMAX_API_KEY: string;
  MINIMAX_GROUP_ID: string;
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
