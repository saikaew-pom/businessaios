-- Creative Studio Release 1B.
-- Additive content-item workspace, creative requests/batches, asset links,
-- lifecycle audit, and server-side review/schedule/manual-publish transitions.

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  pillar TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  visual_suggestion TEXT NOT NULL DEFAULT '',
  expected_engagement TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at INTEGER,
  timezone TEXT,
  approved_at INTEGER,
  approved_by TEXT,
  rejected_at INTEGER,
  rejected_by TEXT,
  rejection_reason TEXT,
  published_ack_at INTEGER,
  published_ack_by TEXT,
  manual_publish_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  UNIQUE(user_id, project_id, source_type, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_content_items_user_status
  ON content_items(user_id, status, scheduled_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_project
  ON content_items(project_id, source_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS creative_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  content_item_id TEXT,
  source_type TEXT NOT NULL,
  source_snapshot_json TEXT NOT NULL DEFAULT '{}',
  brief_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  brand_profile_id TEXT,
  brand_snapshot_id TEXT,
  generation_id TEXT,
  return_route TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(content_item_id) REFERENCES content_items(id),
  FOREIGN KEY(generation_id) REFERENCES media_generations(id)
);

CREATE INDEX IF NOT EXISTS idx_creative_requests_content_item
  ON creative_requests(content_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS creative_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  aggregate_quote_credits INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_creative_batches_user
  ON creative_batches(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS asset_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  content_item_id TEXT,
  creative_request_id TEXT,
  generation_id TEXT,
  asset_id TEXT NOT NULL,
  link_role TEXT NOT NULL DEFAULT 'primary',
  is_primary INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(content_item_id) REFERENCES content_items(id),
  FOREIGN KEY(creative_request_id) REFERENCES creative_requests(id),
  FOREIGN KEY(generation_id) REFERENCES media_generations(id),
  FOREIGN KEY(asset_id) REFERENCES media_assets(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_links_content_item
  ON asset_links(content_item_id, is_primary DESC, version DESC);
CREATE INDEX IF NOT EXISTS idx_asset_links_asset
  ON asset_links(asset_id);

CREATE TABLE IF NOT EXISTS content_item_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  content_item_id TEXT NOT NULL,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(content_item_id) REFERENCES content_items(id)
);

CREATE INDEX IF NOT EXISTS idx_content_item_events_item
  ON content_item_events(content_item_id, created_at DESC);
