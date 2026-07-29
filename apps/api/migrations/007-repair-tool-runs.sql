-- 007: Repair `tool_runs` table — missing from every migration file
--
-- All 10 standalone tool endpoints (/api/tools/pain-generator,
-- /api/tools/brand-voice, etc. — apps/api/src/index.ts) INSERT into
-- `tool_runs` after every AI call, but no migration file has ever created
-- this table. On production it exists (created directly via ad-hoc SQL,
-- like `api_keys` in 006 and the `d1_migrations` bookkeeping gap — see
-- docs/AUDIT.md), which is why the feature works there. On any fresh
-- database (confirmed via a from-scratch local rebuild) every one of the
-- 10 tool endpoints fails with "no such table: tool_runs" after already
-- calling — and paying for — the AI request.
--
-- Schema copied verbatim from `SELECT sql FROM sqlite_master WHERE
-- name='tool_runs'` on production. CREATE TABLE IF NOT EXISTS makes this
-- safe to apply anywhere (fresh or already-patched, local or remote).

CREATE TABLE IF NOT EXISTS tool_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input TEXT,
  output TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_runs_user ON tool_runs(user_id, created_at DESC);
