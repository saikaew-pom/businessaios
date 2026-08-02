-- Brandbook PDF export records. We keep this separate from project exports
-- because exports.project_id is NOT NULL in the legacy MVP schema.

CREATE TABLE IF NOT EXISTS brandbook_exports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brand_kit_id TEXT NOT NULL,
  format TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'th',
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(brand_kit_id) REFERENCES brand_kits(id)
);

CREATE INDEX IF NOT EXISTS idx_brandbook_exports_kit
  ON brandbook_exports(brand_kit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brandbook_exports_user
  ON brandbook_exports(user_id, created_at DESC);
