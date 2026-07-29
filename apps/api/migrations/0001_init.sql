-- MarketingAiOs D1 Schema v1
-- Initial schema: waitlist, projects, api_keys, generations, exports

-- =====================================================
-- Waitlist (Phase 1)
-- =====================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  source TEXT,                -- 'hero' | 'pricing' | 'footer' | 'share'
  locale TEXT DEFAULT 'th',   -- 'th' | 'en'
  referrer TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  notified_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);

-- =====================================================
-- Users (Phase 2)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'team'
  stripe_customer_id TEXT,
  locale TEXT DEFAULT 'th',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

-- =====================================================
-- API Keys (Phase 2 - BYOK)
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,         -- 'openai' | 'anthropic' | 'google'
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,                  -- last 4 chars
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- =====================================================
-- Projects (Phase 2)
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  step_data TEXT,                 -- JSON: {step1, step2, ...}
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'completed' | 'archived'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =====================================================
-- Generations (Phase 2 - AI generation history)
-- =====================================================
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,            -- 'gpt-4o' | 'claude-sonnet-4' | 'gemini-1.5' | 'llama-3.1-70b'
  output TEXT,
  tokens_used INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_generations_project ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_step ON generations(step_number);

-- =====================================================
-- Exports (Phase 2)
-- =====================================================
CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  format TEXT NOT NULL,           -- 'pdf' | 'docx' | 'xlsx' | 'json'
  file_url TEXT NOT NULL,         -- R2 path
  file_size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_exports_project ON exports(project_id);

-- =====================================================
-- Usage Tracking (Phase 2 - rate limit)
-- =====================================================
CREATE TABLE IF NOT EXISTS usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,            -- '2026-07'
  generations_count INTEGER NOT NULL DEFAULT 0,
  exports_count INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_month ON usage(user_id, month);
