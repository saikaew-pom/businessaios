# MarketingAiOs

> **Operating System for AI Marketing** — Fill 7 steps. Get a complete Marketing System.
> Built for Thai SMEs · Runs on Cloudflare · Exports PDF / Word / Excel

[![Status](https://img.shields.io/badge/status-phase%201%20ready-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Cloudflare](https://img.shields.io/badge/cloudflare-pages%20%2B%20workers-orange)]()

---

## 🎯 What is this?

MarketingAiOs is a SaaS that turns the AI Marketing Playbook framework into a step-by-step wizard.
Users answer 30 questions across 7 steps, and AI generates their complete marketing system:
Brand Card, Personas, Customer Journey, Content Calendar, Workflows, and KPI Dashboard.

**Output formats:** PDF · Word (.docx) · Excel (.xlsx) · JSON

---

## 🏗️ Architecture

```
Frontend:  SvelteKit + Tailwind  → Cloudflare Pages
Backend:   Hono + D1 + Resend    → Cloudflare Workers
Storage:   R2 (files)            → Cloudflare R2
AI:        User's API key        → BYOK (OpenAI / Anthropic / Google)
```

See [BLUEPRINT.md](./BLUEPRINT.md) for the complete architecture, decisions, and roadmap.

---

## 📁 Project Structure

```
marketingaios/
├── apps/
│   ├── web/                    # SvelteKit frontend (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── routes/         # Page components
│   │   │   ├── lib/            # i18n, stores, API client
│   │   │   └── app.html
│   │   ├── static/             # Favicon, images
│   │   ├── package.json
│   │   ├── svelte.config.js
│   │   ├── tailwind.config.js
│   │   └── .env.example
│   │
│   └── api/                    # Hono backend (Cloudflare Workers)
│       ├── src/
│       │   ├── index.ts        # Main app + waitlist
│       │   └── email-templates.ts
│       ├── migrations/
│       │   └── 0001_init.sql   # D1 schema
│       ├── package.json
│       ├── tsconfig.json
│       └── wrangler.toml
│
├── packages/
│   ├── prompts/                # 7 prompt templates
│   │   ├── 01-business-dna.md
│   │   ├── 02-customer-persona.md
│   │   ├── 03-customer-journey.md
│   │   ├── 04-positioning.md
│   │   ├── 05-content-calendar.md
│   │   ├── 06-marketing-workflow.md
│   │   ├── 07-kpi-dashboard.md
│   │   └── README.md
│   │
│   └── shared/                 # Shared TypeScript types
│       └── types.ts
│
├── docs/
│   └── DEPLOY.md               # Step-by-step deployment guide
│
├── BLUEPRINT.md                # Source of truth + milestones
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account (free tier OK)
- `wrangler` CLI installed (`npm i -g wrangler`)

### Local Development

```bash
# 1. Install dependencies
cd apps/api && npm install
cd ../web && npm install

# 2. Set up D1 locally
cd ../api
wrangler d1 create marketingaios-db    # Note the database_id
# Update wrangler.toml with database_id
wrangler d1 migrations apply marketingaios-db --local

# 3. Run API
npm run dev    # http://localhost:8787

# 4. Run Web (in another terminal)
cd ../web
cp .env.example .env
# Edit .env: PUBLIC_API_URL=http://localhost:8787
npm run dev    # http://localhost:5173
```

### Deploy to Cloudflare

See [DEPLOY.md](./docs/DEPLOY.md) for full guide.

```bash
# One-time setup
cd apps/api
wrangler login
wrangler d1 create marketingaios-db
wrangler d1 migrations apply marketingaios-db --remote
wrangler secret put RESEND_API_KEY

# Deploy
cd ../web
npm run build
npm run deploy
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 5 + Tailwind CSS 3 + TypeScript |
| Backend | Hono 4 + Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (S3-compatible) |
| AI | OpenAI / Anthropic / Google (BYOK) |
| Email | Resend |
| Auth (Phase 2) | Clerk → Better Auth |
| Payment (Phase 2) | Stripe |
| Deploy | Cloudflare Pages + Workers |

---

## 📊 Features

### Phase 1 — MVP (Live now)

- ✅ Landing page (TH/EN toggle)
- ✅ Waitlist capture + email notification
- ✅ 7 prompt templates (markdown)
- ✅ D1 schema
- ✅ Hono API + CORS
- ⏳ Wizard UI (in progress)

### Phase 2 — Monetize (30-60 days)

- [ ] Auth (Clerk)
- [ ] Wizard UI for 7 steps
- [ ] AI generation engine
- [ ] PDF / Word / Excel export
- [ ] Stripe subscription
- [ ] Industry templates

### Phase 3 — Scale (60-90 days)

- [ ] Workers AI fallback
- [ ] Team collaboration
- [ ] Version history
- [ ] White-label
- [ ] Affiliate program

---

## 💰 Pricing

| Tier | Price | Limits |
|------|-------|--------|
| Free | 0 บาท/mo | 1 project, 5 generations, Workers AI |
| Pro | 499 บาท/mo | 5 projects, 100 generations, all models |
| Team | 1,999 บาท/mo | 20 projects, 500 generations, 5 users |
| Pay-as-you-go | 50 บาท | 10 generations |

---

## 🤝 Contributing

This is a private project. If you have access:

1. Read [BLUEPRINT.md](./BLUEPRINT.md) for context
2. Check [DEPLOY.md](./docs/DEPLOY.md) for setup
3. Update milestones in BLUEPRINT.md
4. Open an issue before major changes

---

## 📜 License

MIT

---

## 🔗 Links

- **Landing page:** https://marketingaios.pages.dev (after deploy)
- **API:** https://marketingaios-api.workers.dev (after deploy)
- **Blueprint:** [BLUEPRINT.md](./BLUEPRINT.md)
- **Deploy guide:** [docs/DEPLOY.md](./docs/DEPLOY.md)

---

**Built with** ❤️ **for Thai SMEs**
