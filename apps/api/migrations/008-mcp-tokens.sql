-- 008: Personal access tokens for the MCP server (Phase D — "connect Claude
-- Code to Business Smart OS"). A user generates a token from
-- /developers, pastes it into their MCP client config, and every MCP
-- tool call authenticates as that user (same credit balance, same data).
--
-- Only a hash of the token is stored — the raw value is shown once at
-- creation and never persisted, same rationale as password hashing (a
-- leaked DB row must not be directly usable as a bearer credential).
--
-- CREATE TABLE IF NOT EXISTS, so it's safe to apply unconditionally on any
-- environment — same migration-safety pattern as 006/007 this session.

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_hint TEXT NOT NULL,
  label TEXT,
  is_active INTEGER DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON mcp_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens(user_id);
