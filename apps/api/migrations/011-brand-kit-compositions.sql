-- Creative Studio Release 1C.
-- Brand Kit and post-generation composition foundation. Rendering may remain
-- disabled by feature flag until the production renderer is selected.

CREATE TABLE IF NOT EXISTS brand_kits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  colors_json TEXT NOT NULL DEFAULT '[]',
  typography_json TEXT NOT NULL DEFAULT '{}',
  rules_json TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user
  ON brand_kits(user_id, is_default DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS brand_kit_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brand_kit_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  role TEXT NOT NULL,
  license_confirmed INTEGER NOT NULL DEFAULT 0,
  license_note TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(brand_kit_id) REFERENCES brand_kits(id),
  FOREIGN KEY(asset_id) REFERENCES media_assets(id)
);

CREATE INDEX IF NOT EXISTS idx_brand_kit_assets_kit
  ON brand_kit_assets(brand_kit_id, role);

CREATE TABLE IF NOT EXISTS composition_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  content_item_id TEXT,
  brand_kit_id TEXT,
  base_asset_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  document_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  exported_asset_id TEXT,
  renderer_version TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(content_item_id) REFERENCES content_items(id),
  FOREIGN KEY(brand_kit_id) REFERENCES brand_kits(id),
  FOREIGN KEY(base_asset_id) REFERENCES media_assets(id),
  FOREIGN KEY(exported_asset_id) REFERENCES media_assets(id)
);

CREATE INDEX IF NOT EXISTS idx_composition_documents_user
  ON composition_documents(user_id, status, updated_at DESC);
