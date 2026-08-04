-- Tie a content series to a project, so the content items it generates land
-- in that project instead of the unassigned pool.
--
-- Before this, contentSeriesRoutes inserted content_items with a hardcoded
-- NULL project_id, so every series-generated item was project-less while
-- Project Step 5 items were properly scoped. With more than one project in
-- play that made /works and /calendar a single undifferentiated pile.
--
-- Nullable on purpose: a series without a project is still valid (that's
-- every series created before this migration, and it stays a legitimate
-- choice for one-off content that doesn't belong to a project).

ALTER TABLE content_series ADD COLUMN project_id TEXT REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_content_series_project
  ON content_series(project_id, created_at DESC);
