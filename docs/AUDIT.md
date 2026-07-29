# MarketingAiOs — Code Audit Report

> จัดทำตอน take over โปรเจกต์ · วันที่ 2026-07-29
> ขอบเขต: `apps/api` (Hono/Workers), `apps/web` (SvelteKit), `apps/web-worker`, migrations, docs
> วิธี: อ่าน source ทั้งหมดของ backend หลัก + สุ่มตรวจ frontend/security surface

---

## STATUS UPDATE (2026-07-29, same day — after fixes applied)

All **Critical** and **High** findings below (C1–C3, H1–H4) are **fixed, tested locally, committed, and pushed** to `main` on https://github.com/saikaew-pom/businessaios. Not yet deployed to the live Cloudflare Workers (`businessaios-api`/`businessaios-web`) — code lives in git + local dev only until a deploy is explicitly requested.

- **C1** — `.gitignore` created and verified (`git check-ignore` + content grep before first commit). Real key rotation in `.env.local` (MiniMax/OpenRouter/ElevenLabs/Brevo/FAL/Turnstile) is still the user's own action item — not something achievable from this session.
- **C2** — CORS no longer reflects arbitrary origins; verified live (disallowed origin gets no `Access-Control-Allow-Origin`, allowed origin still works).
- **C3** — `getMasterSecret` now throws if `MASTER_ENCRYPTION_KEY` is unset instead of falling back to a hardcoded secret.
- **H1** — Duplicate `/api/projects` routes removed; `kind` create/filter verified live against a real request.
- **H2** — Credit deduction is now reserve-before-AI-call (atomic) + refund/true-up after real usage is known; verified live via the `credit_transactions` ledger (reserve → refund entries).
- **H3** — Email-verification gate enabled (was `if (false && ...)`); verified live (blocks unverified, passes after verify).
- **H4** — `rateLimit` wired into 15 previously-unprotected routes (auth + generate + all standalone tools); verified live (429 after 30 req/min).
- **Migration reproducibility** — `apps/api/migrations/006-repair-api-keys.sql` (safe, idempotent, auto-applies everywhere) + `apps/api/manual-repairs/manual-repair-fresh-env.sql` (deliberately NOT in `migrations/`, for fresh-environment `users`/`projects` column repair only — verified against a from-scratch local D1 rebuild).

### New finding from checking live production D1 (read-only, via a user-issued Cloudflare API token)

Production schema turned out to be **healthy** — `users`/`projects` have all expected columns, `api_keys` table exists. The `0003_mvp_clean.sql` destructive-drop ordering bug (documented below under "Migration reproducibility") never actually bit production, because production's real migration history was applied file-by-file by hand rather than through one fresh `wrangler d1 migrations apply` run.

That surfaced a different real bug: wrangler's own `d1_migrations` bookkeeping table only had `0001_init.sql` and `0003_mvp_clean.sql` recorded — `001-v2.sql` through `005-payments.sql` were never marked applied even though their schema changes were already live. This meant a plain `wrangler d1 migrations apply --remote` would have tried to re-run those files and failed with "duplicate column name" errors. **Fixed** (2026-07-29, user ran it directly — Claude Code's own auto-mode classifier blocks direct remote-D1 writes from the agent, by design) by backfilling the 6 missing `d1_migrations` rows to match reality. Verified: `wrangler d1 migrations list --remote` now reports "No migrations to apply!".

### Follow-up bug pass (same day): standalone tools had the same H2/H3 bugs, plus a missing table

Went back through the 10 `/api/tools/*` endpoints (pain-generator, brand-voice, persona-builder, competitor-analysis, jtbd-generator, value-proposition-canvas, business-model-canvas, million-dollar-offer, objection-handler, hook-library) since they were copy-pasted from an earlier version of the main generate handler and hadn't been touched during the C1-H4 pass. Found and fixed, identically to H2/H3:
- Credits deducted after the AI call instead of reserved before it (non-atomic) — same reserve/refund/true-up pattern applied to all 10.
- Email-verification gate dead behind `if (false && ...)` — enabled on all 10.

Also **added M3-style fixes**: `/api/exports/:id` and `/api/tool-exports/:id` had no auth or ownership check at all (anyone who obtained/guessed an export UUID could download another user's document) — added `requireAuth` + `user_id` filtering, verified the existing `<a target="_blank">` download flow still works since the session cookie is `SameSite=None`.

Also fixed `generateOTP()`: was producing 4 digits with a slight modulo bias despite its own docstring claiming 6 — now generates a true unbiased 6-digit code via rejection sampling (used for password-reset and login 2FA).

**New bug found only by live-testing the tool fix:** `tool_runs` — the table all 10 tool endpoints insert into after every AI call — was never created by any migration file. It exists on production (created via untracked manual SQL, same root cause as the `api_keys`/`d1_migrations` gaps above), which is why the feature works there, but a from-scratch database has no such table. Reproduced live: every tool call paid for a real MiniMax generation, then crashed on `INSERT INTO tool_runs` with no refund (the unhandled exception skipped the new reservation's refund logic entirely) — worse than the original bug, since now credits were being silently, permanently lost on every call. Fixed two ways: (1) `007-repair-tool-runs.sql` migration (safe `CREATE TABLE IF NOT EXISTS`, matches production's exact schema) and (2) wrapped the `tool_runs` INSERT in a non-fatal try/catch across all 10 endpoints, since it's a best-effort usage log — a write failure there should never cost the user their already-paid-for AI output or reserved credits. Verified live end-to-end: credit ledger shows `reserve -25 → refund +4 → net -21`, matching actual token usage exactly.

**Still needs (user action, blocked from this session):** run `wrangler d1 migrations apply --remote` against production to pick up `007-repair-tool-runs.sql` — safe now that `d1_migrations` bookkeeping is caught up (it'll only try to apply 007, which is a no-op `CREATE TABLE IF NOT EXISTS` since the table already exists there).

**Resolved same day:** user ran the handed-off command themselves; `wrangler d1 migrations list --remote` now reports "No migrations to apply!" and both API and web workers were redeployed with all of the above live in production.

### M2 (tests) and M1 (monolith split) — done same day, after user said "medium items"

**M2 — added `apps/api`'s first tests (`npm test`, vitest).** No test infra existed at all. Added:
- A **migration gate test** (`test/migrations.test.ts`) that applies every `migrations/*.sql` file against a real in-memory SQLite database (Node's built-in `node:sqlite`) in wrangler's actual apply order. Writing this caught a real bug in the test itself first — wrangler uses a *natural* (numeric-aware) sort of filenames, not a plain lexicographic one; `.sort()` would have tested the wrong order and given false confidence. With the correct order, the test confirmed a known, still-real gap: auto-applied migrations alone don't restore `users`/`projects` columns on a fresh database (only the manual repair script does) — that's now an explicit "known gap" test, alongside a second suite proving the full documented setup procedure (migrations + `manual-repairs/manual-repair-fresh-env.sql`) produces a correct schema.
- Unit tests for `lib/crypto.ts` (password hashing, AES-GCM round-trip, the OTP bias fix, `getMasterSecret`'s fail-closed behavior) and `lib/credit.ts` (the atomic reserve/refund logic H2 depends on) via a small D1-shim over `node:sqlite`.
- 29 tests total, all passing.

**M1 — split `index.ts` from 5,194 to 2,975 lines** (both an active liability — it's exactly how the H1 duplicate-route bug went unnoticed for so long — and a target explicitly called out in this doc). Followed the project's own existing pattern (`presentationRoutes.ts`/`paymentsRoutes.ts`'s `createXRoutes(app)` style) rather than inventing a new one:
- `src/lib/projectExport.ts` — the wizard's HTML/Markdown/CSV/Word-as-HTML export builders (~1,050 lines), mirroring `lib/presentationExport.ts`.
- `src/toolRoutes.ts` — all 10 standalone tool endpoints (~1,050 lines).
- `src/adminRoutes.ts` — the admin panel routes (~115 lines).

Each extraction was verified with `npm run typecheck` (error count stayed at the same 52 pre-existing baseline throughout — confirmed line-by-line that nothing new was introduced), `npm test`, and a live request against the local dev server exercising the moved code specifically (export in all 4 formats, a tool call with a real AI generation, admin stats) before moving to the next piece. One real mistake happened and was caught immediately: the admin extraction's line range was one line short, leaving a stray `});` in `index.ts` and a missing one in the new file — caught by `tsc` failing loudly, fixed, then reverified.

**Not extracted (deliberately, for a future pass):** auth routes, project CRUD + the wizard `generate` endpoint, account/BYOK-keys routes, tool-saves, step-assets/links. These are far more interconnected (shared context-injection logic, several call sites into the same helper functions) than the three pieces above, and this was already a long, careful session — splitting them without rushing deserves its own pass rather than being squeezed in at the end of this one.

---

## 0. สรุปผู้บริหาร (Executive Summary)

โปรเจกต์ **ทำงานได้จริงและมีฟีเจอร์เยอะกว่าที่ docs บอกมาก** — นอกจาก wizard 7 ขั้น ยังมี standalone tools 10+ ตัว, presentation-builder 9 ขั้น, ระบบ credit, Stripe PromptPay, admin, Google OAuth. สถาปัตยกรรมบน Cloudflare (Workers + D1 + R2) เหมาะกับ scale และต้นทุนต่ำ

**ข่าวดี:** SQL ใช้ prepared/bound statements ทั้งหมด (ไม่มี injection), Stripe webhook มีการ verify signature, ไม่มีการ log secret, password ใช้ PBKDF2 + constant-time compare, BYOK key เข้ารหัส AES-GCM

**ข่าวที่ต้องรีบแก้:** มีช่องโหว่ security ระดับวิกฤต 3 จุด (secret รั่ว, CORS เปิดกว้าง, master secret fallback) และบั๊กที่ทำให้ **รายได้/เครดิตรั่ว + ฟีเจอร์ `kind` ใช้ไม่ได้จริง** จากการประกาศ route ซ้ำ

| Severity | จำนวน |
|---|---|
| 🔴 Critical | 3 |
| 🟠 High | 4 |
| 🟡 Medium | 6 |
| 🔵 Low / Info | 4 |

---

## 1. 🔴 Critical

### C1 — Secrets รั่ว + ไม่มี `.gitignore`
- **หลักฐาน:** `.env.local` เก็บ API key จริงเป็น plaintext (MINIMAX, OPENROUTER, ELEVENLAB, BREVO, FAL, TURNSTILE secret) และ root ของโปรเจกต์ **ไม่มี `.gitignore`**
- **ผลกระทบ:** ถ้า commit/push ขึ้น git หรือแชร์โฟลเดอร์ → key รั่วทั้งหมด (คนอื่นเผา quota / ยิงค่าใช้จ่ายเข้าเราได้). `.wrangler/state` (มี D1 snapshot) ก็ไม่ถูก ignore
- **แก้:**
  1. สร้าง `.gitignore`: `.env*`, `.wrangler/`, `node_modules/`, `.svelte-kit/`, `dist/`, `.DS_Store` — **ทำแล้ว (2026-07-29), ก่อน `git init`/commit ครั้งแรกเสมอ**, ยืนยันด้วย `git check-ignore` ว่า `.env.local`/`.dev.vars` ไม่เคยถูก stage เลย → **key ไม่เคยเข้า git history จริง ไม่เคยขึ้น GitHub**
  2. เก็บ secret จริงใน `wrangler secret put` เท่านั้น ไม่เก็บในไฟล์ในรีโป — ทำแล้ว
  3. **Rotate key:** ประเมินใหม่ทีละตัวแทนที่จะ blanket-rotate — MiniMax key เป็น subscription-plan key ที่ user ใช้ร่วมกันหลาย webapp เป็น core AI engine, rotate ไม่ได้โดยไม่กระทบ project อื่น และเพราะไม่เคยเข้า git จริง **จึงไม่จำเป็นต้อง rotate** (ดู STATUS.md). Brevo/Turnstile ยังเป็น optional ตามดุลพินิจ user

### C2 — CORS สะท้อนทุก origin → CSRF / session hijack
- **หลักฐาน:** [apps/api/src/index.ts:36-43](../apps/api/src/index.ts) — มี allowlist แต่บรรทัดสุดท้าย `return origin;` ทำให้ทุก origin ผ่าน. ใช้คู่กับ `credentials: true` + cookie `SameSite=None`
- **ผลกระทบ:** เว็บมุ่งร้ายใด ๆ ยิง request แทน user ที่ล็อกอินอยู่ได้ — อ่าน/ลบ project, สั่ง generate (เผาเครดิต), เปลี่ยน setting, อ่านผลลัพธ์กลับได้
- **แก้:** ลบ `return origin;` ออก ให้ origin ที่ไม่อยู่ใน allowlist คืน `''`/undefined. พิจารณาเพิ่ม CSRF token หรือเปลี่ยนเป็น token-based auth ถ้าจำเป็นต้องข้าม subdomain

### C3 — BYOK master secret มี fallback hardcode ใน source
- **หลักฐาน:** [apps/api/src/lib/crypto.ts:190-197](../apps/api/src/lib/crypto.ts) — `DEFAULT_MASTER_SECRET = 'businessaios-dev-secret-...'`; `getMasterSecret()` fallback ไปใช้ค่านี้ถ้าไม่มี `env.MASTER_ENCRYPTION_KEY`
- **ผลกระทบ:** ถ้า prod ลืมตั้ง env → API key ของ user ทุกคนถูกเข้ารหัสด้วย secret ที่เปิดเผยใน source = ถอดรหัสได้ทันที
- **แก้:** ให้ `getMasterSecret` **throw** ถ้าไม่มี env (fail closed) แทน fallback เงียบ ๆ

---

## 2. 🟠 High

### H1 — Route ประกาศซ้ำ → โค้ดรองรับ `kind` เป็น dead code
- **หลักฐาน:** `/api/projects` (GET/POST) + `/api/projects/:id` ประกาศ 2 รอบ — เวอร์ชันแรก [index.ts:321-383](../apps/api/src/index.ts), เวอร์ชันซ้ำ [index.ts:4874-4944](../apps/api/src/index.ts). Hono ใช้ handler แรกที่ return → เวอร์ชันหลัง (รองรับ `kind`, `archived`, `?kind=` filter) **ไม่เคยรัน**
- **ผลกระทบ:** frontend ([apps/web/src/lib/api.ts:156](../apps/web/src/lib/api.ts)) ส่ง `kind` ตอนสร้างและ filter ด้วย `?kind=` แต่ API เพิกเฉย → โปรเจกต์ทุกตัวได้ kind default, กรองตามชนิดเครื่องมือไม่ได้, response ไม่มี field `kind`
- **แก้:** ลบเวอร์ชันแรกทิ้ง เก็บเวอร์ชัน `kind`-aware ไว้ (หรือรวมเป็นอันเดียว) แล้วเพิ่ม test กันซ้ำ

### H2 — เครดิตหักไม่ atomic + AI รันก่อนหักเงิน → generate ฟรี / double-spend
- **หลักฐาน:** [index.ts:526-711](../apps/api/src/index.ts) — pre-check แค่ `credits >= 1` → เรียก AI → เซฟ output → ค่อย `deductCredits`. ต้นทุนจริง step 5 (~20k tokens) ≈ 40 credits
- **ผลกระทบ:**
  - user มี 1 credit ยิง step แพงได้ output เต็ม; ถ้า `deductCredits` คืน `ok:false` ก็ **ไม่ rollback** — ของถูกส่งไปแล้ว เราจ่ายค่า MiniMax ฟรี
  - concurrent 2 request ผ่าน pre-check พร้อมกัน (double-spend)
- **แก้:** ประเมิน credit ที่ต้องใช้ **ก่อน** เรียก AI แล้วหัก/จองแบบ atomic (`UPDATE ... WHERE credits >= est`) ก่อน; ถ้า usage จริงต่างค่อยปรับส่วนต่างทีหลัง; ปฏิเสธถ้ายอดจองไม่ผ่าน

### H3 — Gate ยืนยันอีเมลถูกปิดด้วย `if (false && ...)`
- **หลักฐาน:** [index.ts:518](../apps/api/src/index.ts) — `if (false && userCheck && userCheck!.email_verified === 0)` คอมเมนต์ว่า "mandatory per user spec" แต่ hardcode ปิด
- **ผลกระทบ:** โค้ด debug ค้าง prod; ถ้าตั้งใจให้บังคับยืนยันอีเมลก็ไม่ทำงาน (สร้าง account ปลอมยิง generate ได้)
- **แก้:** ตัดสินใจ policy ให้ชัด แล้วลบ `false &&` หรือลบทั้ง block

### H4 — Rate limiter เขียนไว้แต่ไม่ได้ต่อสายที่ไหนเลย
- **หลักฐาน:** [middleware.ts:73-98](../apps/api/src/lib/middleware.ts) มี `rateLimit` ครบ แต่ `grep` ทั้งรีโปไม่พบการเรียกใช้
- **ผลกระทบ:** ไม่มี rate limit จริงบน register/login/generate → เสี่ยง brute-force + เผาเครดิต/ค่า AI แบบ automated
- **แก้:** ต่อ `rateLimit` เข้ากับ auth + generate routes (หรือใช้ Cloudflare WAF / Rate Limiting Rules ระดับ edge)

---

## 3. 🟡 Medium

### M1 — `index.ts` เป็น monolith ~5,000 บรรทัด
เป็นสาเหตุโดยตรงของ H1 (route ซ้ำเพราะยาวเกินจะเห็นของเดิม). ควรแตกเป็น `routes/auth.ts`, `routes/projects.ts`, `routes/tools.ts`, `routes/admin.ts` แล้ว mount เข้า main app

### M2 — ไม่มี test เลยสักไฟล์
ขัดกับกติกาในโปรเจกต์เอง (migration/schema change ต้องมี gate test). มี migration 7 ไฟล์ ไม่มี test ครอบ. ควรเริ่มจาก gate test ของ D1 schema + unit test ของ credit/crypto

### M3 — Export endpoint ไม่มี auth / ownership check
[index.ts:1528](../apps/api/src/index.ts) `GET /api/exports/:id` และ [index.ts:3450](../apps/api/src/index.ts) `GET /api/tool-exports/:id` เปิด public. ป้องกันด้วยความสุ่มของ UUID เท่านั้น (capability URL) ไม่มี expiry. ถ้า URL รั่ว (referrer/log) ข้อมูลธุรกิจ user หลุด. ควรเพิ่ม ownership check หรือ signed URL + วันหมดอายุ ถ้าไม่ได้ตั้งใจให้แชร์สาธารณะ

### M4 — เอกสาร drift หนัก
README บอกใช้ "BYOK OpenAI/Anthropic/Google + SvelteKit บน Pages" แต่จริงคือ shared MiniMax key + Workers. STATUS.md (2026-07-25) ไม่พูดถึง tools/payments/presentation ที่มีอยู่จริง. คนที่ take over จะเข้าใจผิด — ควร sync docs ให้ตรงของจริง

### M5 — ชื่อ product แตกเป็นสองชื่อ
สลับ "MarketingAiOs" กับ "BusinessAiOs" ([index.ts:54](../apps/api/src/index.ts) API ตอบ `BusinessAiOs`, secret `businessaios-...`, โดเมน `businessaios.com`). ควรเลือกชื่อเดียวให้ consistent

### M6 — Migration เลขปนกันสองระบบ
`0001_init`, `0003_mvp_clean`, `001-v2`, `002`, `003`, `004`, `005` — ลำดับ apply ไม่ชัด เสี่ยงรันผิดลำดับตอน setup ใหม่. ควร normalize เป็นเลขเรียงระบบเดียว + จด order ที่ apply จริงบน prod

---

## 4. 🔵 Low / Info

- **L1 — Turnstile อาจไม่เคยเปิด:** [config.ts:78](../apps/web/src/lib/config.ts) เช็ก `env.TURNSTILE_SECRET` แต่ `.env.local` สะกดเป็น `TURNSTILE_SECRTE_KEY` (typo). ต้องยืนยันชื่อ binding จริงบน worker; ถ้าผิด bot protection = ปิดตลอด
- **L2 — OTP modulo bias:** [crypto.ts:174](../apps/api/src/lib/crypto.ts) ใช้ `b % 10` มี bias เล็กน้อย (0-5 ออกบ่อยกว่า) — ผลจริงน้อยมากสำหรับ OTP 6 หลัก แต่แก้ง่าย
- **L3 — PBKDF2 100k iterations:** ค่อนข้างต่ำตามมาตรฐานปัจจุบัน (OWASP แนะ 600k สำหรับ SHA-256) แต่บน Workers ต้องบาลานซ์กับ CPU limit — ยอมรับได้ ควรจดเป็น known trade-off
- **L4 — `estimateCost`/pricing เป็นค่าประมาณ hardcode:** [minimax.ts:234](../apps/api/src/lib/minimax.ts) + [credit.ts](../apps/api/src/lib/credit.ts) ถ้าราคา MiniMax เปลี่ยน ต้องแก้มือ — ควร centralize ค่าคงที่ราคาไว้ที่เดียว

---

## 5. Roadmap แนะนำ (ลำดับการแก้)

1. **Security ก่อน:** C1 (rotate keys + .gitignore) → C2 (CORS) → C3 (master secret)
2. **หยุดเงินรั่ว/บั๊ก:** H2 (credit atomic) → H1 (route ซ้ำ) → H3 (email gate) → H4 (rate limit)
3. **แข็งแรงระยะยาว:** M1 (แตกไฟล์) → M2 (เพิ่ม test + gate test) → M3 (export auth)
4. **ความชัดเจน:** M4/M5/M6 (docs + naming + migrations) → L1-L4

> แต่ละข้อควรทำเป็น stage แยก + รัน code-reviewer ก่อนถือว่าเสร็จ ตามกติกาโปรเจกต์
