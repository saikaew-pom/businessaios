-- MANUAL REPAIR — for FRESH environments only. Do NOT run this against the
-- existing production database.
--
-- This file lives OUTSIDE apps/api/migrations/ on purpose: `wrangler d1
-- migrations apply` globs every *.sql file in that directory regardless of
-- naming convention, so keeping this here would make it auto-apply against
-- production the next time someone runs `migrations apply --remote` — which
-- is exactly the risky, unconditional ALTER TABLE this file warns against.
-- Run it explicitly and only after the PRAGMA check below.
--
-- BACKGROUND
-- `0003_mvp_clean.sql` does DROP TABLE + CREATE TABLE on `users` and
-- `projects` (among others) using a bare, original-Phase-1 schema — it does
-- NOT include the columns that `001-v2.sql` (profile/role/credits fields on
-- `users`) and `002-context-and-links.sql` (`kind` on `projects`) add.
-- Because of filename-based apply ordering, a completely fresh
-- `wrangler d1 migrations apply` runs 0001_init -> 001-v2 -> 002-... ->
-- 0003_mvp_clean -> 003 -> 004 -> 005 -> 006, i.e. 0003_mvp_clean runs AFTER
-- 001-v2/002-context-and-links and wipes the columns they added.
--
-- The existing production database almost certainly does NOT have this
-- problem for `users`/`projects` columns, because its migrations were very
-- likely applied incrementally over time in the real chronological order
-- the files were written (which may differ from a fresh alphabetical apply)
-- — but there is no way to verify that without direct Cloudflare/D1 access.
-- DO NOT run this file against production without first checking:
--   wrangler d1 execute businessaios-db --remote --command "PRAGMA table_info(users);"
-- If `first_name`, `email_verified`, `role`, `credits` etc. are already
-- there, skip this file entirely for that database.
--
-- WHEN TO RUN THIS
-- Only when standing up a brand-new environment from scratch (disaster
-- recovery, new Cloudflare account, a fresh staging DB) — run this ONCE,
-- immediately after `wrangler d1 migrations apply`, e.g.:
--   wrangler d1 execute <db-name> --local  --file=migrations/manual-repair-fresh-env.sql
--   wrangler d1 execute <db-name> --remote --file=migrations/manual-repair-fresh-env.sql
-- (only if the PRAGMA check above shows the columns are missing).

ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100;
ALTER TABLE users ADD COLUMN totp_secret TEXT;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

ALTER TABLE projects ADD COLUMN kind TEXT DEFAULT 'playbook';
CREATE INDEX IF NOT EXISTS idx_projects_kind ON projects(user_id, kind, status, updated_at DESC);
