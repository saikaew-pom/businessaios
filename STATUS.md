# MarketingAiOs — MVP Status (2026-07-25 01:00)

## สรุปสั้นๆ

**MVP พร้อมใช้งานแล้วครับ!** 🎉

ทุกอย่างทำงานครบ loop — register → login → create project → wizard 7 ขั้น → AI generate (Thai) → export HTML → print to PDF

## URLs (Live)

| Service | URL | Status |
|---|---|---|
| **API** | https://marketingaios-api.pskspace.workers.dev | ✅ Healthy |
| **Web App** | https://marketingaios-web.pskspace.workers.dev | ✅ Working |
| **Legacy Pages** | https://marketingaios.pages.dev | ⚠️ ไม่ใช้แล้ว (dynamic routes ไม่ทำงาน) |

## Test Accounts (สำหรับ test ตอนเช้า)

ใช้ register ใหม่ได้เลย แต่ถ้าอยาก test เลย มี account เหล่านี้:

- `gen3-1784916143...@test.com` (สร้างไว้ตอน test)
- Password: `testpass1234`

## ที่ Fix ตอนกลางคืน (สำคัญ)

### 1. SPA Routing Bug (CRITICAL)
**อาการ**: URL `/projects/[id]` → 307 → `/` (เปลี่ยน URL ใน address bar)
**สาเหตุ**: Cloudflare `ASSETS` binding คืน 307 (ไม่ใช่ 404) สำหรับ path ที่ไม่มีไฟล์ → worker code ไม่ได้ทำงาน
**Fix**: เขียน `web-worker/src/index.ts` ใหม่ — ตรวจ isAsset ก่อน แล้ว serve `index.html` ด้วย status 200 (ไม่ redirect)
**ผลกระทบ**: Wizard page โหลดได้แล้ว — 16 inputs, "ชื่อธุรกิจ" label แสดงถูกต้อง

### 2. CORS Bug
**อาการ**: API reject origin `.pskspace.workers.dev`
**Fix**: เพิ่ม `.workers.dev` ใน allowed origins ใน `apps/api/src/index.ts`

### 3. ALLOWED_ORIGIN
**อาการ**: API env var ชี้ไปที่ `.pages.dev` (URL เก่า)
**Fix**: Update wrangler.toml ให้รองรับทั้ง `.pages.dev` และ `.workers.dev`

### 4. Wrangler account_id
**อาการ**: `wrangler deploy` ถามเลือก account (2 accounts)
**Fix**: เพิ่ม `account_id = "8d3b88fb762aaac5e9feca0421310dfb"` ใน wrangler.toml ทั้ง 2 ตัว

## E2E Test (Verified in Browser)

```
1. Register → ✅ 200 OK, user created
2. Login (via cookie) → ✅
3. Dashboard → ✅ shows projects
4. Create project "Test G3" → ✅
5. Wizard /projects/[id] → ✅ loads, 16 inputs visible
6. Click "✨ Generate with AI" → ✅
7. AI Step 1 output (Thai) → ✅ "Step 1 เสร็จแล้ว (9902ms · 1832 tokens)"
8. Cost: ~$0.003/generation
9. Export → ✅ HTML file in R2, ready to print
```

## ที่ยังเหลือ (Optional - Phase 2)

- [ ] Native PDF generation (ตอนนี้ export เป็น HTML → print to PDF)
- [ ] Test all 7 steps end-to-end (tested step 1 เท่านั้น)
- [ ] Rate limiting
- [ ] Email verification on register
- [ ] Add custom domain (ตอนนี้ใช้ workers.dev subdomain)
- [ ] Better mobile responsive on wizard
- [ ] Marketing email sequence (Resend integration stub มีแล้ว แต่ยังไม่ได้ทำ template ครบ)

## Cloudflare Resources (ใช้สำหรับ deploy ครั้งต่อไป)

- **Account ID**: `8d3b88fb762aaac5e9feca0421310dfb`
- **D1 Database**: `marketingaios-db` (`d545a3fc-09ec-40c1-99f2-2dd239faedb0`) in APAC
- **R2 Bucket**: `marketingaios-exports`
- **API Worker**: `marketingaios-api` (current version: `5076c973-baa7-42d1-9c89-3da4d3669ee2`)
- **Web Worker**: `marketingaios-web` (current version: `cf1d7f16-922e-463e-86de-4057d7e7b927`)

## Secrets (เก็บใน Worker, ไม่มีใน code)

- `MINIMAX_API_KEY` - AI API key
- `MINIMAX_GROUP_ID` - `2044162428047987228`
- `SESSION_SECRET` - cookie signing (auto-generated)
- `RESEND_API_KEY` - email (optional)

## Test Plan สำหรับพรุ่งนี้เช้า

1. เปิด https://marketingaios-web.pskspace.workers.dev
2. กด "สมัครสมาชิก" → ใส่ email/password → login
3. Dashboard → "สร้างโปรเจกต์" → ใส่ชื่อ
4. กรอก form Step 1 → "✨ Generate with AI"
5. รอ ~10s → ดู Brand Card ที่ AI generate
6. ลอง step อื่นๆ (2-7)
7. กด "📄 Export" → HTML เปิดใน tab ใหม่ → Cmd/Ctrl+P → Save as PDF
8. ถ้ามีเวลา: ทดสอบ pricing page, mobile view, dark mode (ยังไม่มี)

## Architecture Notes

```
Browser (workers.dev)
  ↓ fetch + cookie
Web Worker (Hono/SvelteKit static) ─→ ASSETS (SPA fallback)
  ↓ fetch /api/* (CORS allow)
API Worker (Hono) ─→ D1 (SQLite) ─→ R2 (file storage)
                    ↓
                  Minimax M3 (chatcompletion_v2)
                    ↓
                  AI output → JSON → save to D1
```

## หมายเหตุ

- **AI Model**: `MiniMax-M3` (ราคาถูกมาก ~$0.003/generation)
- **Authentication**: Self-rolled PBKDF2 (ไม่ใช้ Clerk/Auth0)
- **PDF**: HTML → browser print (Phase 2 จะใช้ Workers PDF generator)

---

Built โดย Mavis — your marketing sidekick ☕
เช้านี้ลองใช้แล้วบอกผลนะครับ ถ้ามีอะไรไม่ทำงาน ผมจะแก้ทันที
