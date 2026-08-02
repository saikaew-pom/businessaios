-- Brandbook Builder foundation.
-- Adds lifecycle and structured brandbook metadata without rewriting existing
-- brand kit rows. Existing kits become active drafts by default.

ALTER TABLE brand_kits ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE brand_kits ADD COLUMN deleted_at INTEGER;
ALTER TABLE brand_kits ADD COLUMN archived_at INTEGER;
ALTER TABLE brand_kits ADD COLUMN brandbook_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE brand_kits ADD COLUMN default_language TEXT NOT NULL DEFAULT 'th';

CREATE INDEX IF NOT EXISTS idx_brand_kits_user_lifecycle
  ON brand_kits(user_id, lifecycle_status, is_default DESC, updated_at DESC);
