-- =====================================================
-- Platform-level provider API keys (admin-managed, not a Worker secret)
-- Lets an admin paste a provider API key (e.g. fal.ai) into the admin panel
-- and have it adopted immediately, encrypted at rest, without a deploy.
-- Distinct from `api_keys`, which is per-user BYOK.
-- =====================================================
CREATE TABLE IF NOT EXISTS platform_provider_keys (
  provider TEXT PRIMARY KEY,
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,
  is_active INTEGER DEFAULT 1,
  updated_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
