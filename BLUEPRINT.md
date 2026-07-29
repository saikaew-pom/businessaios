# MarketingAiOs — Source of Truth

> **"Operating System for AI Marketing"** — ใส่ข้อมูลธุรกิจ 7 ขั้นตอน กดปุ่ม ได้ marketing system ครบชุด
> Export เป็น PDF / Word / Excel ได้ · รันบน Cloudflare ทั้งหมด

**Status Legend:** `[ ]` Pending · `[~]` In Progress · `[x]` Done · `[-]` Cancelled
**Last Updated:** 24 July 2026

---

## 🎯 Project Status

- [ ] **Phase 0 — Planning & Setup** (Week 0)
- [ ] **Phase 1 — MVP** (Day 1-30)
- [ ] **Phase 2 — Monetize** (Day 31-60)
- [ ] **Phase 3 — Scale** (Day 61-90)
- [ ] **Phase 4 — Enterprise** (Day 90+)

---

## 1. Big Idea

**One-liner:**
> ใส่ข้อมูลธุรกิจ 7 ขั้นตอน กดปุ่ม ได้ marketing system ครบชุด — Brand Card + Persona + Content + Workflow + KPI — export PDF/Word/Excel ได้

**Target user:**
- SME owner + Marketing manager ในไทย
- ไม่อยากเรียน prompt แต่อยากได้ output พร้อมใช้

**ต่างจากคู่แข่ง:**
- ไม่ใช่ chatbot ถามตอบ — เป็น **wizard step-by-step ที่กันคนตอบผิด**
- ไม่ต้องเรียน prompt — **user แค่กรอกแบบฟอร์ม**
- Output เป็น **asset พร้อมใช้** ไม่ใช่ "ข้อความใน chat"

---

## 2. User Flow — "The Magic Moment" (7 Steps Wizard)

```
[Sign Up] → [Plug API Key] → [7-Step Wizard] → [AI Generate] → [Review/Edit] → [Export]
```

| Step | ชื่อ | เวลา | Input | AI Output |
|------|------|------|-------|-----------|
| 1 | Business DNA | 5 นาที | ชื่อ/ประเภท/ลูกค้า/Pain 3 ข้อ | Brand Card 5 ข้อ |
| 2 | Customer Persona | 10 นาที | รีวิว/สัมภาษณ์ (paste ได้) | Persona 3 แบบ + quote จริง |
| 3 | Customer Journey | 5 นาที | 5 จุดสัมผัส | Journey map + emotion curve |
| 4 | Positioning | 5 นาที | คู่แข่ง 3 เจ้า + จุดต่าง | Positioning Statement + UVP |
| 5 | Content Calendar | 10 นาที | ช่องทาง + โพสต์/สัปดาห์ | Content 30 วัน + caption + hook + CTA |
| 6 | Marketing Workflow | 5 นาที | งานที่ทำซ้ำ | 3 Workflow ที่ใช้ AI |
| 7 | KPI Dashboard | 5 นาที | เป้ารายได้/Lead/Conversion | Dashboard template + Action Plan 30 วัน |

**Total: 45 นาที** → marketing system ครบ 1 ชุด

---

## 3. Feature List

### 3.1 MVP (Day 1-30) — Core

- [ ] **Auth System** — Email + Google login (via Clerk)
- [ ] **API Key Vault** — เก็บ key encrypted (AES-256) รองรับ OpenAI/Claude/Gemini
- [ ] **Multi-Model Switcher** — เลือก AI model ต่อ generation
- [ ] **7-Step Wizard UI** — Form-based, validation, save draft อัตโนมัติ
- [ ] **AI Generation Engine** — เรียก API พร้อม prompt ที่ผูกกับ framework
- [ ] **Asset Library** — เก็บ output ทุกครั้งที่ generate
- [ ] **Export PDF** — Branded (Noto Sans Thai + accent)
- [ ] **Export Word (.docx)** — Edit ได้
- [ ] **Export Excel (.xlsx)** — Content calendar + KPI
- [ ] **Project Limit** — 1 project (Free) / 5 projects (Pro)
- [ ] **Landing Page** — Hero + features + pricing + CTA
- [ ] **Documentation** — Help center / FAQ

### 3.2 Phase 2 (Day 31-60) — Monetize

- [ ] **Stripe Integration** — Subscription + THB support
- [ ] **Paywall Enforcement** — Free tier limits
- [ ] **Industry Templates** — 3 verticals: คลินิก / ร้านอาหาร / อสังหา
- [ ] **Email Onboarding** — Drip campaign 7 วัน
- [ ] **Usage Dashboard** — แสดง generations / cost / project status
- [ ] **Token Counter** — แสดง cost ต่อ generation
- [ ] **Project Sharing** — Share link (view-only) ให้ stakeholder

### 3.3 Phase 3 (Day 61-90) — Scale

- [ ] **Workers AI Fallback** — Llama 3.1 / Mistral (Cloudflare ฟรี)
- [ ] **Team Collaboration** — Multi-user ต่อ project
- [ ] **Version History** — เก็บ generations เก่า + restore
- [ ] **AI Cost Calculator** — เปรียบเทียบ model cost
- [ ] **White-label** — Pro tier ใส่ logo ตัวเอง
- [ ] **Affiliate Program** — ให้ AI coach อื่นแนะนำ
- [ ] **Webhook API** — ให้เครื่องอื่นเรียก MarketingAiOs

### 3.4 Future (Day 90+)

- [ ] **Mobile App** — iOS / Android
- [ ] **Marketplace** — คนขาย template / prompt
- [ ] **Custom Models** — Fine-tune บนข้อมูลลูกค้า
- [ ] **Multi-language** — EN / TH / ZH
- [ ] **Slack/Teams Integration** — Generate ใน Slack
- [ ] **Browser Extension** — Generate ตอนอ่านบทความ

---

## 4. Cloudflare Architecture

### 4.1 System Diagram

```
┌─────────────────────────────────────────┐
│      Cloudflare Pages (Frontend)         │
│      SvelteKit + Tailwind CSS            │
└────────────────┬────────────────────────┘
                 │ HTTPS / JSON
                 ↓
┌─────────────────────────────────────────┐
│       Cloudflare Workers (API)          │
│           Hono Framework                  │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │  Auth    │ │ Generate │ │ Export  │ │
│  └──────────┘ └──────────┘ └─────────┘ │
└────┬──────────┬──────────┬──────────────┘
     │          │          │
     ↓          ↓          ↓
  ┌──────┐  ┌──────┐  ┌──────────┐
  │  D1  │  │  R2  │  │   KV     │
  │ (DB) │  │(Files)│  │(Sessions)│
  └──────┘  └──────┘  └──────────┘
                 │
                 ↓
  ┌──────────────────────────────────┐
  │   External AI APIs (BYOK)        │
  │   - OpenAI (GPT-4o, GPT-4o-mini) │
  │   - Anthropic (Claude Sonnet)    │
  │   - Google (Gemini 1.5)          │
  │   - Cloudflare Workers AI        │
  │     (Llama 3.1 70B, Mistral)     │
  └──────────────────────────────────┘
```

### 4.2 Tech Stack

| Layer | Service | เหตุผล |
|-------|---------|--------|
| **Frontend** | SvelteKit on Pages | เร็ว, bundle เล็ก, edge-ready, dev experience ดี |
| **Backend** | Hono on Workers | เร็วที่สุด, type-safe, Vercel/Cloudflare compatible |
| **Database** | D1 (SQLite at edge) | ฟรี tier ใหญ่ (5GB), query เร็ว, replication global |
| **Storage** | R2 | เก็บ PDF/DOCX/XLSX, S3-compatible, 10GB ฟรี |
| **Cache** | KV | sessions, rate limit, fast key-value |
| **Auth** | Clerk → Better Auth (เมื่อ scale) | OAuth + email + magic link |
| **Payment** | Stripe (THB support) | recurring + one-time, webhook stable |
| **Email** | Resend | transaction email, dev experience ดี |
| **Analytics** | Cloudflare Analytics + PostHog | usage + product analytics |
| **PDF** | pdf-lib (browser) / ReportLab (server) | branded output |
| **Word** | docx (npm) | .docx generation |
| **Excel** | exceljs (npm) | .xlsx generation |

### 4.3 Cloudflare Cost (ประมาณ)

| Resource | Free Tier | Pro Tier Need |
|----------|-----------|---------------|
| Pages | 500 builds/mo + unlimited requests | ไม่ต้อง |
| Workers | 100,000 req/day | $5/mo สำหรับ 10M req |
| D1 | 5M reads + 100K writes/day | $5/mo สำหรับ 25M reads |
| R2 | 10GB storage + 10M reads | $0.015/GB + reads |
| KV | 100K reads/day | $0.50/10M reads |

**Free tier ครอบคลุม:** 0-1,000 users
**Pro tier (~$15/mo):** 1,000-10,000 users

---

## 5. AI Strategy — "BYOK + Smart Fallback"

### 5.1 Three Modes

| Mode | Tier | Key Source | Cost |
|------|------|------------|------|
| **BYOK** (Bring Your Own Key) | Free | ใส่ API key เอง | User จ่ายตรง AI provider |
| **Credits** (ระบบขาย) | Pro | MarketingAiOs key | Markup ~30% |
| **Workers AI** (Free fallback) | Free | Cloudflare | $0 |

### 5.2 Smart Routing Logic

```typescript
async function generate(prompt: string, complexity: 'simple' | 'medium' | 'complex') {
  // 1. ถ้า user มี key → ใช้ key user
  // 2. ถ้า user ไม่มี key แต่ Pro → ใช้ MarketingAiOs key
  // 3. ถ้า Free → fallback Workers AI

  if (complexity === 'complex') {
    // Positioning, Brand Card → default Claude Sonnet
    return await callClaude(prompt, userKey);
  }

  if (complexity === 'simple') {
    // Rephrase, summarize → default GPT-4o-mini (ถูก)
    return await callOpenAI(prompt, 'gpt-4o-mini', userKey);
  }

  // Fallback Workers AI
  return await callWorkersAI(prompt);
}
```

### 5.3 API Key Encryption

```typescript
// Store
const encrypted = await encrypt(apiKey, ENCRYPTION_KEY);
await db.apiKeys.create({ userId, encryptedKey: encrypted });

// Retrieve
const apiKey = await decrypt(record.encryptedKey, ENCRYPTION_KEY);
// ใช้ apiKey เรียก AI API แล้วลบทิ้งจาก memory
```

- **Encryption:** AES-256-GCM
- **Key management:** Wrangler secret (`wrangler secret put ENCRYPTION_KEY`)
- **UI:** แสดงแค่ last 4 chars เช่น `sk-...abc123`

---

## 6. Data Model (D1 Schema)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'free',     -- 'free' | 'pro' | 'team'
  stripe_customer_id TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- API Keys (encrypted)
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,        -- 'openai' | 'anthropic' | 'google'
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,                 -- last 4 chars เช่น '...abc1'
  is_default BOOLEAN DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  step_data JSON,                -- {step1: {...}, step2: {...}, ...}
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft',   -- 'draft' | 'completed' | 'archived'
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Generations (history)
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  step_number INTEGER,
  prompt TEXT,
  model TEXT,                    -- 'gpt-4o' | 'claude-sonnet-4' | 'gemini-1.5' | 'llama-3.1-70b'
  output TEXT,
  tokens_used INTEGER,
  cost_usd REAL,
  created_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Exports
CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  format TEXT,                   -- 'pdf' | 'docx' | 'xlsx' | 'json'
  file_url TEXT,                 -- R2 path
  file_size INTEGER,
  created_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Templates (Pro+)
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,                 -- 'clinic' | 'restaurant' | 'realestate' | 'general'
  step_data JSON,
  is_public BOOLEAN DEFAULT 0,
  author_id TEXT,
  created_at INTEGER
);

-- Usage Tracking (rate limit)
CREATE TABLE usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT,                    -- '2026-07'
  generations_count INTEGER DEFAULT 0,
  exports_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_generations_project ON generations(project_id);
CREATE INDEX idx_usage_user_month ON usage(user_id, month);
```

---

## 7. Export Module

### 7.1 PDF

**Stack:** Cloudflare Worker + ReportLab (Python) หรือ pdf-lib (Node.js)
**Template:** เอา design จาก AI Marketing Playbook (Noto Sans Thai + accent color)
**Sections:**
- Cover page (project name + date)
- Brand Card (5 ข้อ)
- Persona (3 แบบ + quote)
- Customer Journey (5 จุด + emotion curve)
- Positioning Statement
- Content Calendar (30 วัน)
- Marketing Workflow (3 อัน)
- KPI Dashboard + Action Plan 30 วัน

### 7.2 Word (.docx)

**Stack:** `docx` (npm)
**Editable:** User เปิดใน Word/Google Docs แก้ต่อได้
**Sections:** เหมือน PDF แต่ format เป็น heading + table

### 7.3 Excel (.xlsx)

**Stack:** `exceljs` (npm)
**Sheets:**
- **Brand Card** (rows: 5 ข้อ, cols: ข้อ/รายละเอียด)
- **Persona** (rows: 3 แบบ, cols: ชื่อ/อายุ/Pain/quote/ช่องทาง)
- **Content Calendar** (rows: 30 วัน, cols: วันที่/หัวข้อ/แพลตฟอร์ม/hook/CTA)
- **KPI Dashboard** (rows: 5 KPIs, cols: metric/target/actual/status)
- **Action Plan** (rows: 4 weeks, cols: task/owner/deadline/status)

### 7.4 Bonus: JSON / CSV

- **JSON:** Full structured data สำหรับ developer
- **CSV:** Raw data สำหรับ import เครื่องอื่น

---

## 8. Pricing (Monetization)

| Tier | ราคา/เดือน | ได้อะไร |
|------|------------|---------|
| **Free** | 0 บาท | 1 project, 5 generations, Workers AI (Llama), export PDF only |
| **Pro** | 499 บาท | 5 projects, 100 generations, ทุก model, export PDF/DOCX/XLSX, industry templates |
| **Team** | 1,999 บาท | 20 projects, 500 generations, 5 users, white-label, priority support |
| **Pay-as-you-go** | 50 บาท | ซื้อ 10 generations เพิ่ม (สำหรับ spike) |

**Annual:** Pro = 4,990 บาท/ปี (ลด 17%), Team = 19,990 บาท/ปี

### 8.1 Revenue Projection (Conservative)

| Period | Free | Pro | Team | MRR (บาท) |
|--------|------|-----|------|-----------|
| Month 1-3 | 50 | 5 | 0 | 2,500 |
| Month 4-6 | 200 | 30 | 3 | 33,000 |
| Month 7-12 | 1,000 | 100 | 10 | 70,000 |
| Year 1 total | 1,250 avg | 45 avg | 4 avg | **~360,000 บาท** |

**Year 2 target:** 5,000 free + 500 Pro + 30 Team = ~310,000 บาท/เดือน (~3.7M บาท/ปี)

---

## 9. Roadmap & Milestones

### 9.1 Phase 0 — Planning & Setup (Week 0)

- [ ] ตัดสินใจ tech stack (SvelteKit + Hono)
- [ ] สร้าง Cloudflare account + domain
- [ ] Set up project structure + GitHub repo
- [ ] ออกแบบ landing page
- [ ] เขียน privacy policy + ToS
- [ ] ตั้ง Stripe account (THB)

### 9.2 Phase 1 — MVP (Day 1-30)

#### Week 1: Foundation
- [ ] Cloudflare Workers + Pages setup
- [ ] Hono API skeleton
- [ ] D1 schema migrations
- [ ] Clerk Auth integration
- [ ] Landing page deploy

#### Week 2: Wizard UI
- [ ] SvelteKit form components
- [ ] Step 1: Business DNA form
- [ ] Step 2-3: Persona + Journey forms
- [ ] Step 4-5: Positioning + Calendar forms
- [ ] Step 6-7: Workflow + KPI forms
- [ ] Save draft logic

#### Week 3: AI Integration
- [ ] API key vault (encrypt/decrypt)
- [ ] OpenAI integration
- [ ] Anthropic (Claude) integration
- [ ] Google (Gemini) integration
- [ ] Multi-model switcher
- [ ] Prompt templates for each step

#### Week 4: Export + Polish
- [ ] PDF export (ReportLab)
- [ ] Word export (docx)
- [ ] Excel export (exceljs)
- [ ] Asset library UI
- [ ] Onboarding flow
- [ ] Bug bash + launch beta

**MVP Launch Criteria:**
- [ ] User can sign up + plug API key
- [ ] User can complete 7-step wizard
- [ ] User can generate at least 1 output
- [ ] User can export PDF
- [ ] Site load time < 2s

### 9.3 Phase 2 — Monetize (Day 31-60)

#### Week 5-6: Payment
- [ ] Stripe Checkout integration
- [ ] Webhook handlers
- [ ] Plan enforcement (Free vs Pro)
- [ ] Usage tracking
- [ ] Billing dashboard
- [ ] Receipt emails

#### Week 7: Templates
- [ ] Template data structure
- [ ] คลินิก template (research + write)
- [ ] ร้านอาหาร template
- [ ] อสังหา template
- [ ] Template browser UI

#### Week 8: Growth
- [ ] Email onboarding (7-day drip)
- [ ] Referral program
- [ ] SEO landing pages
- [ ] LinkedIn content (10 posts)
- [ ] Beta user outreach (20 SMEs)

**Monetize Launch Criteria:**
- [ ] 3 paying customers
- [ ] 100 free signups
- [ ] 1st 5-star review

### 9.4 Phase 3 — Scale (Day 61-90)

#### Week 9-10: Workers AI + Cost
- [ ] Workers AI integration
- [ ] Smart routing logic
- [ ] Cost calculator UI
- [ ] Token usage dashboard

#### Week 11: Team
- [ ] Team accounts (multi-user)
- [ ] Project sharing
- [ ] Activity log
- [ ] Permissions

#### Week 12: Polish
- [ ] Version history
- [ ] White-label support
- [ ] Webhook API
- [ ] Documentation site
- [ ] Affiliate program

**Scale Launch Criteria:**
- [ ] 20 paying customers
- [ ] MRR 50,000+ บาท
- [ ] Team feature used by 3+ accounts

### 9.5 Phase 4 — Enterprise (Day 90+)

- [ ] SSO (SAML)
- [ ] Custom branding
- [ ] Dedicated support
- [ ] Custom integrations
- [ ] API rate limits tiered
- [ ] Audit logs

---

## 10. Architecture Decision Log

| Date | Decision | Why | Alternatives |
|------|----------|-----|--------------|
| 2026-07-24 | SvelteKit over Next.js | bundle เล็กกว่า, dev experience ดี, edge-native | Next.js (mature), Vue/Nuxt |
| 2026-07-24 | Hono over Express | edge-first, type-safe, Vercel/Cloudflare compatible | Express, Fastify |
| 2026-07-24 | D1 over Postgres | free tier ใหญ่, edge replication, พอสำหรับ MVP | Neon, Supabase, PlanetScale |
| 2026-07-24 | R2 over S3 | S3-compatible, zero egress, อยู่ใน Cloudflare ecosystem | AWS S3, Backblaze B2 |
| 2026-07-24 | BYOK model | ต้นทุน 0 ตอน scale, user จ่าย AI ตรง | Mark up 100% (ต้นทุนสูง) |
| 2026-07-24 | Clerk over Better Auth | quick setup, OAuth ครบ, migrate ทีหลังได้ | Auth0, Supabase Auth, custom |
| 2026-07-24 | Stripe over Omise | recurring + global, webhook stable | Omise (PromptPay), 2C2P |
| 2026-07-24 | Wizard over Chatbot | structured, validation, no hallucination | Chat interface (UX unclear) |

---

## 11. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI API rate limit / downtime | High | Multi-provider fallback (OpenAI + Claude + Gemini + Workers AI) |
| User data leak (API key) | Critical | AES-256 encryption, never log keys, audit quarterly |
| Generation quality inconsistent | High | Prompt templates tested 100+ times, allow regeneration |
| User ไม่กลับมาใช้ซ้ำ | Medium | Email drip, version history, monthly check-in |
| คู่แข่งเปิดตัวคล้ายๆ | Medium | เน้น Thai-context + framework เฉพาะ (SPICE/CRAFT) |
| Cloudflare pricing surprise | Low | Monitor usage, alert at 80% tier |
| Stripe THB support issue | Low | Omise backup |

---

## 12. Success Metrics

### 12.1 Product Metrics

- [ ] **Activation rate:** 60% (sign up → complete wizard) | target 80%
- [ ] **Generation success rate:** 95% | target 99%
- [ ] **Export success rate:** 98% | target 99.5%
- [ ] **Time to first output:** < 60 นาที | target 30 นาที
- [ ] **Free → Pro conversion:** 5% | target 10%

### 12.2 Business Metrics

- [ ] **MRR (Month 3):** 30,000 บาท
- [ ] **MRR (Month 6):** 100,000 บาท
- [ ] **MRR (Month 12):** 300,000 บาท
- [ ] **CAC:** < 500 บาท
- [ ] **LTV:** > 5,000 บาท
- [ ] **Churn:** < 5%/เดือน

### 12.3 User Metrics

- [ ] **NPS:** 40+ | target 60+
- [ ] **MAU/DAU ratio:** 0.4 | target 0.5
- [ ] **Avg generations/user/month:** 10+ | target 30+

---

## 13. Open Questions

- [ ] ชื่อ domain จริง — `marketingaios.com`? `marketingaios.co`? `marketingaios.app`?
- [ ] Landing page copy — ภาษาไทยล้วน / อังกฤษล้วน / bilingual?
- [ ] Onboarding — require API key ก่อน หรือหลัง wizard?
- [ ] Free tier limit — 5 generations/เดือน พอเกินไปไหม?
- [ ] Template ตัวแรก — เลือก vertical ไหน? (แนะนำ: คลินิก — pain point ชัด, willingness to pay สูง)
- [ ] Marketing channel — focus LinkedIn หรือ Facebook เป็น primary?
- [ ] จะใช้ Playbook เป็น lead magnet หรือไม่?

---

## 14. Repository Structure (แนะนำ)

```
marketingaios/
├── apps/
│   ├── web/                 # SvelteKit frontend
│   └── api/                 # Hono backend (Cloudflare Worker)
├── packages/
│   ├── shared/              # Shared types
│   ├── prompts/             # AI prompt templates
│   └── ui/                  # Shared components
├── docs/
│   ├── BLUEPRINT.md         # ← ไฟล์นี้
│   ├── API.md
│   └── DEPLOYMENT.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── package.json
├── turbo.json               # Turborepo
└── README.md
```

---

## 15. Quick Reference Commands

```bash
# Dev
cd apps/web && npm run dev          # SvelteKit dev
cd apps/api && npm run dev          # Worker dev

# Deploy
cd apps/web && npm run deploy       # Pages
cd apps/api && npm run deploy       # Workers

# D1 migrations
wrangler d1 create marketingaios
wrangler d1 migrations apply marketingaios --local
wrangler d1 migrations apply marketingaios --remote

# Secrets
wrangler secret put ENCRYPTION_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put STRIPE_SECRET_KEY

# Logs
wrangler tail                         # Worker logs
```

---

## 16. Next Step (วันนี้)

**Pick ONE ทำใน 24 ชั่วโมง:**

- [ ] **Option A: Deploy Landing Page** — 1 วัน, validate demand ก่อน
- [ ] **Option B: Build Wizard Step 1** — 3 วัน, validate UX
- [ ] **Option C: Set up Cloudflare + Auth** — 1 วัน, foundation
- [ ] **Option D: Write 3 prompt templates** — 2 วัน, เนื้อหาหลัก

**แนะนำ: Option A** — deploy landing page ก่อน เพื่อเก็บ email waitlist
วัดว่ามีคนสนใจจริงไหม ก่อน invest 30 วัน build

---

## 17. Notes & Ideas (parking lot)

- [ ] **Idea:** "AI Audit ฟรี" เป็น lead magnet — user กรอก 3 ข้อ ได้ audit report
- [ ] **Idea:** ทำ Playbook เป็น free tier — แล้ว upsell MarketingAiOs
- [ ] **Idea:** Community Discord สำหรับ AI coach
- [ ] **Idea:** Partner กับสถาบัน (เช่น SIPA, TDGA) ให้นักเรียนใช้
- [ ] **Idea:** White-label ให้ SME consultant เอาไปขายใต้แบรนด์ตัวเอง
- [ ] **Idea:** B2B2C — ให้ SME consultant ซื้อ seat แล้วขายต่อให้ลูกค้า

---

**Maintained by:** [ชื่อคุณ]
**Last review:** 24 July 2026
**Next review:** ทุกวันศุกร์ 18:00

> 💡 **How to use this file:**
> 1. Update status ทุกวันก่อนเลิกงาน
> 2. Check milestone ทุกวันศุกร์
> 3. Add new decisions ลง Section 10 ทันที
> 4. Add new risks ลง Section 11
> 5. Review Section 9 ทุกสัปดาห์
