-- Migration 002: per-step context (notes + files) + project links + project kind

-- =====================================================
-- PROJECTS: add kind (playbook / brand_voice / pain_points / persona)
-- =====================================================
ALTER TABLE projects ADD COLUMN kind TEXT DEFAULT 'playbook';
CREATE INDEX IF NOT EXISTS idx_projects_kind ON projects(user_id, kind, status, updated_at DESC);

-- =====================================================
-- STEP ASSETS: per-step notes + uploaded files
-- Used for additional context when regenerating
-- =====================================================
CREATE TABLE IF NOT EXISTS step_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,  -- 1-7, or 0 for project-level (tool context)
  kind TEXT NOT NULL,  -- 'note' | 'file' | 'link' | 'inline_text'
  title TEXT,  -- user-provided label
  content TEXT,  -- for notes: text content
  file_url TEXT,  -- for files: R2 key
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  source TEXT,  -- 'user_upload' | 'tool_save' | 'project_link'
  source_id TEXT,  -- tool_save.id or project.id
  source_meta JSON,  -- any metadata
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_step_assets_project ON step_assets(project_id, step_number);
CREATE INDEX IF NOT EXISTS idx_step_assets_source ON step_assets(source, source_id);

-- =====================================================
-- PROJECT LINKS: link a project to another project or tool
-- Used for step 2 (Persona) to reference Brand Voice / Pain Points projects
-- =====================================================
CREATE TABLE IF NOT EXISTS project_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,  -- The consuming project (the playbook)
  target_kind TEXT NOT NULL,  -- 'project' | 'tool_save'
  target_id TEXT NOT NULL,  -- project.id or tool_save.id
  link_purpose TEXT,  -- 'persona_input' | 'context' | 'inspiration'
  step_number INTEGER,  -- which step uses this link
  created_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_links_project ON project_links(project_id, step_number);
CREATE INDEX IF NOT EXISTS idx_project_links_target ON project_links(target_kind, target_id);
