-- 0003: Reset schema for MVP
-- Drops old Phase 1 tables and creates clean MVP schema

DROP TABLE IF EXISTS exports;
DROP TABLE IF EXISTS generations;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS usage;
DROP TABLE IF EXISTS users;

-- =====================================================
-- Users (auth)
-- =====================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  locale TEXT DEFAULT 'th',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan ON users(plan);

-- =====================================================
-- Sessions
-- =====================================================
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- =====================================================
-- Projects
-- =====================================================
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  step_data TEXT NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  locale TEXT DEFAULT 'th',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- =====================================================
-- Generations
-- =====================================================
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  model TEXT,
  output TEXT,
  cost_usd REAL,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_generations_project ON generations(project_id);
CREATE INDEX idx_generations_user ON generations(user_id);
CREATE UNIQUE INDEX idx_generations_unique ON generations(project_id, step_number);

-- =====================================================
-- Exports
-- =====================================================
CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  format TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_exports_project ON exports(project_id);
CREATE INDEX idx_exports_user ON exports(user_id);
