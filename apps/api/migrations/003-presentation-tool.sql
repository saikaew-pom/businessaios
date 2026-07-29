-- Migration 003: Presentation Tool (AI Presentation Builder)
-- 9-step wizard: Brief → Audience → ATR → Source → Triage → Outline → Blueprint → Notes → Export

-- =====================================================
-- PRESENTATION PROJECTS — top-level container
-- =====================================================
CREATE TABLE IF NOT EXISTS presentation_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,         -- 'informative' | 'persuasive' | 'story'
  target_slides INTEGER NOT NULL DEFAULT 10,
  time_minutes INTEGER NOT NULL DEFAULT 15,
  language TEXT DEFAULT 'th',     -- 'th' | 'en'
  color_theme TEXT DEFAULT 'business_blue',  -- one of 10 color themes
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'completed' | 'archived'
  current_step INTEGER NOT NULL DEFAULT 1,
  -- System prompt overrides per step (for advanced users, JSON: {step1: 'custom', step6: 'custom'})
  prompt_overrides TEXT,          -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_presentation_projects_user
  ON presentation_projects(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_presentation_projects_status
  ON presentation_projects(user_id, status);

-- =====================================================
-- PRESENTATION STEPS — one row per step (1-9)
-- Stores input + AI output + which framework variant used
-- =====================================================
CREATE TABLE IF NOT EXISTS presentation_steps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,   -- 1-9
  input_json TEXT,                -- user input for this step
  output_json TEXT,               -- AI output
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'generating' | 'done' | 'error'
  error TEXT,                     -- last error message
  tokens_used INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,
  -- Which framework variant was used (for step 6, 7, 8)
  framework_variant TEXT,         -- 'scqa_minto' | '5m_mission' | 'popup_pitch' | NULL
  -- Custom system prompt override (if user edited it)
  custom_system_prompt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(project_id, step_number),
  FOREIGN KEY (project_id) REFERENCES presentation_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_presentation_steps_project
  ON presentation_steps(project_id, step_number);

-- =====================================================
-- PRESENTATION EXPORTS — log of generated files
-- =====================================================
CREATE TABLE IF NOT EXISTS presentation_exports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  format TEXT NOT NULL,           -- 'html' | 'md' | 'json' | 'csv' | 'doc' | 'pptx' | 'gsheet'
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  slide_count INTEGER,            -- for PPTX
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES presentation_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_presentation_exports_project
  ON presentation_exports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presentation_exports_user
  ON presentation_exports(user_id, created_at DESC);

-- =====================================================
-- PRESENTATION STEP ASSETS — notes + files for presentation tool
-- Reuses step_assets pattern from playbook tool
-- =====================================================
-- (Using existing step_assets table with source='presentation')
-- No new table needed; presentation projects will set source appropriately
