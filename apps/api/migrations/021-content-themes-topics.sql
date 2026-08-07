-- Content Playbook Upgrade Plan ขั้นที่ 2 — ธีมเสาหลัก + Topic Picker
-- (docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md §6).
--
-- Two new entities, deliberately separate from each other and from the
-- existing content_series/content_items tables:
--
-- content_themes — "ธีมเสาหลัก": 3-5 AI-proposed brand content pillars, an
-- axis distinct from content_items.pillar (the funnel-stage axis:
-- awareness/education/social_proof/conversion — see gap #3 in the plan's
-- own audit). A user confirms/renames a subset; confirmed theme NAMES are
-- also synced into the existing brand_profiles.content_pillars_json (kept
-- empty by ขั้นที่ 1 on purpose) so brand-context prompts see them, but the
-- themes themselves live here because topic generation needs a stable id to
-- scope de-dup history against ("history ต่อ pillar").
--
-- content_topics — the actual "Topic Picker" cards: title + content-type tag
-- only (never a caption — ideation must stay cheap, per the plan's own
-- "output แค่ชื่อเรื่อง + enum tags" constraint), generated 8-12 per theme.
-- Persisted (not ephemeral) for two reasons: (1) de-dup — future ideation
-- calls for the same theme need to see what's already been suggested, same
-- reasoning as the existing per-project hook history in content_series
-- generation; (2) "cache ผลไว้" — a returning user sees the same set without
-- paying for a fresh AI call until they explicitly ask for more.
--
-- content_type is a 14-value enum (4 groups: ขายฝัน/Expert/Engagement/
-- Review) — NOT enforced by a SQL CHECK constraint, matching this
-- codebase's existing convention for content_items.pillar (also
-- unconstrained at the DB layer; enforced in application code only, see
-- REQUIRED_TABLES gate test and contentThemeRoutes.ts).
--
-- seasonal_event is a free-text key into a static, non-AI Thai marketing
-- calendar (lib/creative/thaiMarketingCalendar.ts) — nullable, most topics
-- have no seasonal tie-in.

CREATE TABLE IF NOT EXISTS content_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  brand_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested | confirmed | dismissed
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(brand_profile_id) REFERENCES brand_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_content_themes_brand
  ON content_themes(brand_profile_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS content_topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  theme_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  seasonal_event TEXT,
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested | used | dismissed
  used_series_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(theme_id) REFERENCES content_themes(id),
  FOREIGN KEY(used_series_id) REFERENCES content_series(id)
);

CREATE INDEX IF NOT EXISTS idx_content_topics_theme
  ON content_topics(theme_id, status, created_at DESC);
