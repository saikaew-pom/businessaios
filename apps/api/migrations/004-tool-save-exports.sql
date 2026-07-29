-- =====================================================
-- Tool Save Exports (separate table — exports.project_id has FK NOT NULL)
-- =====================================================
CREATE TABLE IF NOT EXISTS tool_save_exports (
  id TEXT PRIMARY KEY,
  tool_save_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  format TEXT NOT NULL,         -- 'md' | 'json'
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tool_save_id) REFERENCES tool_saves(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_save_exports_save ON tool_save_exports(tool_save_id);
CREATE INDEX IF NOT EXISTS idx_tool_save_exports_user ON tool_save_exports(user_id);
