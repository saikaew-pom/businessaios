-- Add a single representative-customer persona + past-post voice samples to
-- brand_profiles, for Content Playbook Upgrade Plan "ขั้นที่ 1 — Brand
-- Bootstrap + ลูกค้า 1 คน" (docs/CONTENT_PLAYBOOK_UPGRADE_PLAN.md §6).
--
-- This is deliberately a much lighter shape than the project wizard's
-- multi-persona step2 output (name/demographics/psychographics/pain_points
-- array/etc, see prompts.ts) — this is ONE persona, kept small on purpose
-- so it's cheap to inject into every content-generation prompt as grounding
-- context, not a research artifact of its own:
--   { name, age, job, daily_life, complaints: [string, string, string] }
-- `complaints` is always exactly 3 short, verbatim-style sentences (enforced
-- in application code, not SQL) — the plan's own wording is explicit that
-- this must stay short ("ห้ามยาวกว่านี้").
--
-- voice_samples_json is a plain string[] of past post text that worked well
-- for this brand — the cheapest quality lever for a model that's weak at
-- free-form writing but good at following a worked example.
--
-- Both nullable: a profile created before this migration (or via the
-- no-persona path) is still a fully valid brand profile.

ALTER TABLE brand_profiles ADD COLUMN persona_json TEXT;
ALTER TABLE brand_profiles ADD COLUMN voice_samples_json TEXT;
