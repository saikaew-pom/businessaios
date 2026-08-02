-- Creative Studio Release 1A foundation.
-- Additive only: model catalog, media/job bookkeeping, Brand Context Lite,
-- pricing quotes, upload intents, webhook events, and durable work items.

CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  model_type TEXT NOT NULL DEFAULT 'image',
  operation TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  pricing_json TEXT NOT NULL,
  pricing_version TEXT NOT NULL,
  safety_config_json TEXT NOT NULL DEFAULT '{}',
  adapter_config_json TEXT NOT NULL DEFAULT '{}',
  config_version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_maintenance INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, provider_model_id, operation)
);

CREATE INDEX IF NOT EXISTS idx_ai_models_active
  ON ai_models(is_active, is_maintenance, sort_order);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  generation_id TEXT,
  asset_type TEXT NOT NULL,
  source TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  thumbnail_r2_key TEXT,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  favorite INTEGER NOT NULL DEFAULT 0,
  lifecycle_status TEXT NOT NULL DEFAULT 'active',
  checksum_sha256 TEXT,
  archived_at INTEGER,
  deleted_at INTEGER,
  purge_after INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_user_status
  ON media_assets(user_id, lifecycle_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_generation
  ON media_assets(generation_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_checksum
  ON media_assets(user_id, checksum_sha256);

CREATE TABLE IF NOT EXISTS media_pricing_quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  pricing_version TEXT NOT NULL,
  credits INTEGER NOT NULL,
  pricing_snapshot_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_generation_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(model_id) REFERENCES ai_models(id)
);

CREATE INDEX IF NOT EXISTS idx_media_pricing_quotes_user
  ON media_pricing_quotes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_pricing_quotes_lookup
  ON media_pricing_quotes(user_id, model_id, request_hash, expires_at);

CREATE TABLE IF NOT EXISTS media_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  client_idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  quote_id TEXT NOT NULL,
  creative_request_id TEXT,
  current_attempt_id TEXT,
  operation TEXT NOT NULL,
  prompt TEXT NOT NULL,
  resolved_prompt TEXT,
  options_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  submission_state TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  estimated_credits INTEGER NOT NULL,
  final_credits INTEGER,
  pricing_version TEXT NOT NULL,
  pricing_snapshot_json TEXT NOT NULL,
  expected_output_count INTEGER NOT NULL DEFAULT 1,
  delivered_output_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  brand_profile_id TEXT,
  brand_snapshot_id TEXT,
  next_poll_at INTEGER,
  last_polled_at INTEGER,
  poll_attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER,
  delivery_deadline_at INTEGER,
  cancel_requested_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(model_id) REFERENCES ai_models(id),
  FOREIGN KEY(quote_id) REFERENCES media_pricing_quotes(id),
  UNIQUE(user_id, client_idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_media_generations_user_status
  ON media_generations(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_generations_work
  ON media_generations(status, next_poll_at, lease_until);

CREATE TABLE IF NOT EXISTS generation_references (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  mention_name TEXT NOT NULL,
  reference_role TEXT NOT NULL,
  influence_level TEXT NOT NULL DEFAULT 'balanced',
  sort_order INTEGER NOT NULL DEFAULT 0,
  crop_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(generation_id) REFERENCES media_generations(id),
  FOREIGN KEY(asset_id) REFERENCES media_assets(id),
  UNIQUE(generation_id, mention_name)
);

CREATE INDEX IF NOT EXISTS idx_generation_references_generation
  ON generation_references(generation_id, sort_order);

CREATE TABLE IF NOT EXISTS generation_attempts (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  provider_request_id TEXT,
  callback_correlation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_submit',
  request_summary_json TEXT NOT NULL DEFAULT '{}',
  provider_cost_usd REAL,
  error_code TEXT,
  submit_started_at INTEGER,
  submit_completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(generation_id) REFERENCES media_generations(id),
  UNIQUE(callback_correlation_id)
);

CREATE INDEX IF NOT EXISTS idx_generation_attempts_generation
  ON generation_attempts(generation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_attempts_provider_request
  ON generation_attempts(provider, provider_request_id);

CREATE TABLE IF NOT EXISTS media_credit_holds (
  generation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reserved_credits INTEGER NOT NULL,
  final_credits INTEGER,
  status TEXT NOT NULL DEFAULT 'reserved',
  reserve_transaction_id TEXT,
  final_transaction_id TEXT,
  refund_transaction_id TEXT,
  expires_at INTEGER NOT NULL,
  settlement_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(generation_id) REFERENCES media_generations(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_media_credit_holds_status
  ON media_credit_holds(status, expires_at);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  business_summary TEXT NOT NULL DEFAULT '',
  audience_json TEXT NOT NULL DEFAULT '[]',
  tone_of_voice_json TEXT NOT NULL DEFAULT '[]',
  content_pillars_json TEXT NOT NULL DEFAULT '[]',
  offers_json TEXT NOT NULL DEFAULT '[]',
  rules_json TEXT NOT NULL DEFAULT '{}',
  default_reference_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  schema_version INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_user
  ON brand_profiles(user_id, is_default DESC, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_profiles_one_default
  ON brand_profiles(user_id)
  WHERE is_default = 1;

CREATE TABLE IF NOT EXISTS brand_profile_selections (
  user_id TEXT PRIMARY KEY,
  active_profile_id TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(active_profile_id) REFERENCES brand_profiles(id)
);

CREATE TABLE IF NOT EXISTS brand_context_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brand_profile_id TEXT,
  profile_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(brand_profile_id) REFERENCES brand_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_brand_context_snapshots_profile
  ON brand_context_snapshots(brand_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_request_id TEXT,
  payload_hash TEXT NOT NULL,
  signature_verified INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_webhook_events_status
  ON provider_webhook_events(processing_status, received_at);

CREATE TABLE IF NOT EXISTS media_work_items (
  id TEXT PRIMARY KEY,
  generation_id TEXT,
  asset_id TEXT,
  work_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  available_at INTEGER NOT NULL,
  lease_until INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  payload_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(dedupe_key),
  FOREIGN KEY(generation_id) REFERENCES media_generations(id),
  FOREIGN KEY(asset_id) REFERENCES media_assets(id)
);

CREATE INDEX IF NOT EXISTS idx_media_work_items_claim
  ON media_work_items(status, available_at, lease_until, created_at);
CREATE INDEX IF NOT EXISTS idx_media_work_items_generation
  ON media_work_items(generation_id);

CREATE TABLE IF NOT EXISTS media_upload_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expected_mime_type TEXT NOT NULL,
  expected_size INTEGER NOT NULL,
  quarantine_r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(asset_id) REFERENCES media_assets(id),
  UNIQUE(token_hash)
);

CREATE INDEX IF NOT EXISTS idx_media_upload_intents_user
  ON media_upload_intents(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_upload_intents_expiry
  ON media_upload_intents(status, expires_at);
