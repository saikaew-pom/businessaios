-- 006: Repair `api_keys` table dropped by 0003_mvp_clean.sql
--
-- 0003_mvp_clean.sql does `DROP TABLE IF EXISTS api_keys;` (as part of a
-- broader schema reset) but never recreates it, and no migration since has
-- either. On ANY environment where 0003_mvp_clean.sql has run, `api_keys` is
-- currently missing — which breaks the BYOK feature (GET/POST/PUT/DELETE
-- /api/keys in apps/api/src/index.ts) with "no such table: api_keys".
--
-- This uses CREATE TABLE IF NOT EXISTS, so it's safe to apply unconditionally
-- to any environment (fresh or already-patched, local or remote) — it will
-- never error, unlike a blind ALTER TABLE ADD COLUMN would on a table that
-- might already have the column. See docs/AUDIT.md (M6 / migration
-- reproducibility) for the full story, including the `users`/`projects`
-- column drift this same root cause also introduced — that repair is NOT
-- included here because it's only safe on a genuinely fresh database; see
-- apps/api/manual-repairs/manual-repair-fresh-env.sql.

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,
  label TEXT,
  is_active INTEGER DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(user_id, provider);
