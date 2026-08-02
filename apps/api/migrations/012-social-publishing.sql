-- Creative Studio Phase 10.
-- Provider-agnostic direct publishing scaffold. OAuth/app-review/provider
-- adapters stay feature-gated until external platform requirements are met.

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  provider_parent_id TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_key_version TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  token_expires_at INTEGER,
  connection_status TEXT NOT NULL DEFAULT 'needs_setup',
  last_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  UNIQUE(user_id, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user
  ON social_accounts(user_id, provider, connection_status);

CREATE TABLE IF NOT EXISTS social_publications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  content_item_id TEXT NOT NULL,
  social_account_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload_snapshot_json TEXT NOT NULL,
  asset_snapshot_json TEXT NOT NULL DEFAULT '[]',
  idempotency_key TEXT NOT NULL,
  scheduled_at INTEGER,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  remote_post_id TEXT,
  remote_post_url TEXT,
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_submitted_at INTEGER,
  last_reconciled_at INTEGER,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(content_item_id) REFERENCES content_items(id),
  FOREIGN KEY(social_account_id) REFERENCES social_accounts(id),
  UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_social_publications_content
  ON social_publications(content_item_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_publications_work
  ON social_publications(status, scheduled_at, updated_at);

CREATE TABLE IF NOT EXISTS social_publish_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  publication_id TEXT,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  payload_hash TEXT NOT NULL,
  signature_verified INTEGER NOT NULL DEFAULT 0,
  normalized_outcome TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(publication_id) REFERENCES social_publications(id),
  UNIQUE(provider, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_social_publish_events_publication
  ON social_publish_events(publication_id, received_at DESC);
