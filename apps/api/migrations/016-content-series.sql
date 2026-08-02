-- Content Series Generator: templates (admin-global or user-private) and
-- the generation batches that produce content_items in bulk from one topic.

CREATE TABLE IF NOT EXISTS content_series_templates (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  owner_user_id TEXT, -- NULL for admin/global templates, visible to every user
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  slots_json TEXT NOT NULL DEFAULT '[]', -- [{pillar, hook_style, cta_style, notes}], cycled across N items
  default_platforms_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_content_series_templates_visibility
  ON content_series_templates(owner_type, owner_user_id, is_active);

CREATE TABLE IF NOT EXISTS content_series (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT,
  brand_profile_id TEXT,
  brand_snapshot_id TEXT,
  topic TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  cadence_days REAL NOT NULL DEFAULT 1,
  start_date INTEGER,
  platforms_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued', -- queued | generating | completed | failed
  generated_count INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(template_id) REFERENCES content_series_templates(id),
  FOREIGN KEY(brand_snapshot_id) REFERENCES brand_context_snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_content_series_user
  ON content_series(user_id, created_at DESC);

-- Trace generated content_items back to the series batch that produced them.
ALTER TABLE content_items ADD COLUMN series_id TEXT REFERENCES content_series(id);
ALTER TABLE content_items ADD COLUMN series_slot_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_content_items_series
  ON content_items(series_id, series_slot_index);
