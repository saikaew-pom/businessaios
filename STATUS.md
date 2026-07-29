# BusinessAiOs — Status

> Last updated: 2026-07-29 (take-over + security/bug-fix pass, see `docs/AUDIT.md` for full detail)

## What this actually is (docs had drifted from reality)

Not just a 7-step wizard — the live product also includes:
- **Playbook wizard** (7 steps): Brand Card → Persona → Journey → Positioning → Content Calendar → Marketing Workflow → KPI Dashboard
- **10 standalone AI tools**: pain-generator, brand-voice, persona-builder, competitor-analysis, jtbd-generator, value-proposition-canvas, business-model-canvas, million-dollar-offer, objection-handler, hook-library
- **Presentation builder** (9-step deck generator, separate route namespace `/api/presentation/*`)
- **Credit system** (signup bonus + Stripe PromptPay top-ups)
- **Admin panel**, Google OAuth, BYOK API keys (encrypted), 2FA, saved tool runs library

## URLs (Live)

| Service | URL |
|---|---|
| **API** | https://businessaios-api.pskspace.workers.dev |
| **Web App** | https://businessaios-web.pskspace.workers.dev |

(Note: the `marketingaios-*` URLs referenced in older docs no longer exist — the live workers are named `businessaios-api` / `businessaios-web`. See `docs/AUDIT.md` M5 for the naming-drift finding; "BusinessAiOs" is what's actually deployed everywhere, so that's the name being kept.)

## Architecture

```
Browser
  ↓ fetch + cookie (SameSite=None)
Web Worker (businessaios-web) — serves SvelteKit static build, SPA fallback
  ↓ fetch /api/* (CORS: allowlist only — pages.dev / workers.dev / businessaios.com / localhost)
API Worker (businessaios-api, Hono) ─→ D1 (businessaios-db) ─→ R2 (businessaios-exports)
                    ↓
                  Minimax M3 (chatcompletion_v2)
```

- **Auth**: self-rolled PBKDF2 + session cookie (not Clerk/Auth0)
- **AI**: shared MINIMAX_API_KEY (server-side), not per-user BYOK for the main flows — BYOK exists as an opt-in feature (`/api/keys`) but isn't the default
- **Credits**: 1 credit ≈ $0.001; reserved atomically before every AI call, refunded/trued-up after real usage is known (fixed 2026-07-29 — see below)

## 2026-07-29 fix pass (Critical + High + a follow-up bug round)

Full findings and evidence in `docs/AUDIT.md`. Summary of what changed and is now **live in production**:

- **Security**: CORS no longer reflects arbitrary origins (was open to CSRF/session-hijack); BYOK master-secret now fails closed instead of falling back to a hardcoded dev secret; `.gitignore` added before first commit (real keys were sitting in plaintext `.env.local`).
- **Correctness**: duplicate `/api/projects` route removed (the `kind` feature — filtering projects by tool type — silently never worked before this); credit deduction changed from "charge after the AI call" (non-atomic, could give free generations) to "reserve before, refund/true-up after" — applied to the wizard's generate endpoint **and all 10 standalone tools** (they had the same bug, copy-pasted); email-verification gate enabled (was dead code behind `if (false && ...)`); rate limiting wired into all auth/generate/tool endpoints (previously written but never attached to any route).
- **Data exposure**: `/api/exports/:id` and `/api/tool-exports/:id` had no auth at all — anyone with (or guessing) an export UUID could download someone else's generated document. Now requires ownership.
- **Schema drift repaired**: `0003_mvp_clean.sql` (an early migration) drops and recreates tables without the columns/tables later migrations added — harmless on production today only because production's migrations were applied by hand over time rather than as one fresh run, but a truly fresh database (disaster recovery, new environment) would be broken. Added a proper repair path (`006-repair-api-keys.sql`, `007-repair-tool-runs.sql`, `manual-repairs/manual-repair-fresh-env.sql`) and fixed wrangler's own migration-tracking table (`d1_migrations`) to match reality so `wrangler d1 migrations apply --remote` works normally again.
- **OTP**: was generating 4 slightly-biased digits despite the code claiming 6 — now a true unbiased 6-digit code (password reset + login 2FA).

**Repo**: code is on GitHub at https://github.com/saikaew-pom/businessaios (`main`), not just local — this project wasn't a git repo before this pass.

## Known, deliberate non-fixes

- **Turnstile bot-protection is off** (`TURNSTILE_REQUIRED="false"` in `apps/api/wrangler.toml`) — not a bug, the secret itself is correctly configured on the worker; this is a live policy toggle, left alone pending a product decision on whether to require it.
- **Migration file numbering** (`0001_init.sql`, `001-v2.sql`, `0003_mvp_clean.sql`, ...) is inconsistent but intentionally NOT being renamed/reordered — doing so would desync wrangler's `d1_migrations` bookkeeping (which matches by filename) from the already-applied state on production.

## Still open

- [ ] Rotate the real API keys that sat in root `.env.local` before `.gitignore` existed (MiniMax, Brevo, Turnstile are the ones actually used in code)
- [ ] Split `apps/api/src/index.ts` (~5,000 lines, dozens of routes) into modules
- [ ] Test coverage (currently zero — no test files anywhere in the repo)
- [ ] Native PDF generation (still HTML → browser print)
- [ ] Custom domain (still on `*.workers.dev` subdomains)

## Cloudflare Resources

- **Account**: PSK Account (`8d3b88fb762aaac5e9feca0421310dfb`)
- **D1 Database**: `businessaios-db` (`d545a3fc-09ec-40c1-99f2-2dd239faedb0`), APAC
- **R2 Bucket**: `businessaios-exports`
- **API Worker**: `businessaios-api`
- **Web Worker**: `businessaios-web`

## Secrets (set via `wrangler secret put`, never in code/repo)

`MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`, `BREVO_API_KEY`, `TURNSTILE_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus Stripe keys for payments (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and `MASTER_ENCRYPTION_KEY` for BYOK.
