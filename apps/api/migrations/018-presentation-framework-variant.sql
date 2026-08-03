-- `framework_variant` was referenced throughout presentationRoutes.ts and
-- several wizard step components as if it lived on `presentation_projects`,
-- but the column only ever existed on `presentation_steps` — every read of
-- `project.framework_variant` was silently `undefined`. It's a pure
-- function of `objective` (informative->scqa_minto, story->popup_pitch,
-- else 5m_mission), so persist it as a real column, backfilled from each
-- project's existing objective, and keep it in sync whenever objective is
-- edited (see the updated PUT /api/presentation/projects/:id handler).
ALTER TABLE presentation_projects ADD COLUMN framework_variant TEXT;

UPDATE presentation_projects SET framework_variant = CASE objective
  WHEN 'informative' THEN 'scqa_minto'
  WHEN 'story' THEN 'popup_pitch'
  ELSE '5m_mission'
END WHERE framework_variant IS NULL;
