# MarketingAiOs — Code Audit Report

> จัดทำตอน take over โปรเจกต์ · วันที่ 2026-07-29
> ขอบเขต: `apps/api` (Hono/Workers), `apps/web` (SvelteKit), `apps/web-worker`, migrations, docs
> วิธี: อ่าน source ทั้งหมดของ backend หลัก + สุ่มตรวจ frontend/security surface (ยังไม่แก้โค้ด)

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
  1. **Rotate key ทุกตัวทันที** (ถือว่า compromised แล้ว)
  2. สร้าง `.gitignore`: `.env*`, `.wrangler/`, `node_modules/`, `.svelte-kit/`, `dist/`, `.DS_Store`
  3. เก็บ secret จริงใน `wrangler secret put` เท่านั้น ไม่เก็บในไฟล์ในรีโป

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
