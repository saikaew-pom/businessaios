# MarketingAiOs

> **Operating System for AI Marketing** — Fill 7 steps. Get a complete Marketing System.
> Built for Thai SMEs · Runs on Cloudflare · Exports PDF / Word / Excel

[![Status](https://img.shields.io/badge/status-phase%201%20ready-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Cloudflare](https://img.shields.io/badge/cloudflare-pages%20%2B%20workers-orange)]()

---

## 🎯 What is this?

BusinessAiOs (repo name is still MarketingAiOs, live product is branded BusinessAiOs — see
[STATUS.md](./STATUS.md)) is a SaaS built around the AI Marketing Playbook framework. Beyond the
7-step wizard, it also ships **10 standalone AI tools** (pain-generator, brand-voice,
persona-builder, competitor-analysis, jtbd-generator, value-proposition-canvas,
business-model-canvas, million-dollar-offer, objection-handler, hook-library), a 9-step
**presentation builder**, a credit system with Stripe PromptPay top-ups, and an admin panel.
Users answer questions across 7 steps, and AI generates their complete marketing system:
Brand Card, Personas, Customer Journey, Content Calendar, Workflows, and KPI Dashboard.

**Output formats:** HTML (print-to-PDF) · Markdown · JSON · CSV

For the current live status, what's actually deployed, and recent fixes, see
[STATUS.md](./STATUS.md) and [docs/AUDIT.md](./docs/AUDIT.md) — this README describes the
original design; STATUS.md tracks reality.

---

## 🏗️ Architecture

```
Frontend:  SvelteKit + Tailwind  → Cloudflare Workers (static assets + SPA fallback, see apps/web-worker)
Backend:   Hono + D1             → Cloudflare Workers
Storage:   R2 (files)            → Cloudflare R2
AI:        Shared server-side key (MiniMax M3) → BYOK (encrypted, opt-in via /api/keys) available but not the default
Email:     Brevo
Payments:  Stripe (PromptPay)
```

See [BLUEPRINT.md](./BLUEPRINT.md) for the original architecture/decisions doc and
[STATUS.md](./STATUS.md) for what's actually running today.

---

## 📁 Project Structure

```
marketingaios/                  # repo name; live product is branded BusinessAiOs
├── apps/
│   ├── web/                    # SvelteKit frontend
│   │   ├── src/
│   │   │   ├── routes/         # Page components — wizard, 10 standalone tools,
│   │   │   │                   #   presentation-builder, dashboard, billing, admin
│   │   │   ├── lib/            # i18n, stores, API client, presets
│   │   │   └── app.html
│   │   ├── static/              # Favicon, images
│   │   ├── package.json
│   │   ├── svelte.config.js
│   │   ├── tailwind.config.js
│   │   └── .env.example
│   │
│   ├── web-worker/              # Serves apps/web's static build + SPA fallback
│   │   └── src/index.ts         # (Cloudflare Pages caused SPA routing bugs — see STATUS.md)
│   │
│   └── api/                    # Hono backend (Cloudflare Workers)
│       ├── src/
│       │   ├── index.ts               # Main app: auth, projects/wizard, 10 tools, admin
│       │   ├── presentationRoutes.ts  # 9-step presentation builder
│       │   ├── paymentsRoutes.ts      # Stripe PromptPay
│       │   └── lib/                   # crypto, credit, minimax client, prompts, email...
│       ├── migrations/         # D1 schema — see docs/AUDIT.md re: numbering/ordering
│       ├── manual-repairs/     # NOT auto-applied — see file header before running
│       ├── package.json
│       ├── tsconfig.json
│       └── wrangler.toml
│
├── packages/
│   ├── prompts/                 # 7 wizard prompt templates
│   │   ├── 01-business-dna.md
│   │   ├── 02-customer-persona.md
│   │   ├── 03-customer-journey.md
│   │   ├── 04-positioning.md
│   │   ├── 05-content-calendar.md
│   │   ├── 06-marketing-workflow.md
│   │   ├── 07-kpi-dashboard.md
│   │   └── README.md
│   │
│   └── shared/                  # Shared TypeScript types
│       └── types.ts
│
├── docs/
│   ├── AUDIT.md                 # Security/bug audit + fix log — start here
│   └── DEPLOY.md                # Step-by-step deployment guide
│
├── BLUEPRINT.md                 # Original architecture/decisions doc
├── STATUS.md                    # Current live status — source of truth for "what's true now"
└── README.md                    # This file
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
cd ../web-worker && npm install

# 2. Set up D1 locally (database name/id must match apps/api/wrangler.toml)
cd ../api
wrangler d1 migrations apply businessaios-db --local
# Create apps/api/.dev.vars with at least MINIMAX_API_KEY, MINIMAX_GROUP_ID,
# MASTER_ENCRYPTION_KEY, SESSION_SECRET — see docs/AUDIT.md for why the
# master-secret one now fails closed instead of silently defaulting.

# 3. Run API
npm run dev    # http://localhost:8787

# 4. Run Web (in another terminal)
cd ../web
echo "PUBLIC_API_URL=http://localhost:8787" > .env.local
npm run dev    # http://localhost:5173
```

### Deploy to Cloudflare

See [DEPLOY.md](./docs/DEPLOY.md) for the original setup guide (some details predate the current
worker names — use `businessaios-*`, not `marketingaios-*`).

```bash
# API
cd apps/api
npx wrangler deploy

# Web — build SvelteKit, stage the SPA shell, deploy via web-worker
# (apps/web's own `npm run deploy` targets Cloudflare Pages, which STATUS.md
# retired due to SPA routing bugs — don't use it; use scripts/deploy-web.sh)
cd ..
bash scripts/deploy-web.sh
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 5 + Tailwind CSS 3 + TypeScript |
| Backend | Hono 4 + Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (S3-compatible) |
| AI | MiniMax M3 (shared server key) — BYOK available as an opt-in feature (`/api/keys`, AES-GCM encrypted) |
| Email | Brevo |
| Auth | Self-rolled (PBKDF2 + session cookie), plus Google OAuth |
| Payment | Stripe (PromptPay) |
| Deploy | Cloudflare Workers (`businessaios-api`, `businessaios-web`) |

---

## 📊 Features (what's actually live)

- ✅ Landing page (TH/EN toggle)
- ✅ Auth: register/login/logout, email verification, password reset (OTP), Google OAuth, 2FA
- ✅ 7-step wizard with AI generation, per-step context injection, linked-project context
- ✅ 10 standalone AI tools (see STATUS.md for the full list)
- ✅ 9-step presentation builder
- ✅ Credit system with signup bonus + Stripe PromptPay top-ups (see Pricing below)
- ✅ BYOK: encrypted per-user API keys as an alternative to the shared credit pool
- ✅ Admin panel (users, credits, stats, email log)
- ✅ Export to HTML (print-to-PDF), Markdown, JSON, CSV
- ⏳ Native PDF generation (currently HTML → browser print)
- ⏳ Test coverage (currently none — see docs/AUDIT.md)

---

## 💰 Pricing (real credit packages, `apps/api/src/lib/packages.ts`)

1 credit ≈ $0.001 in underlying AI cost. New accounts get 200 credits free on signup.

| Package | Credits | Price | Per credit |
|---|---|---|---|
| Starter | 100 | 99 บาท | 0.99 บาท |
| Popular | 300 | 249 บาท | 0.83 บาท |
| Pro | 500 | 399 บาท | 0.80 บาท |

Credits never expire. No subscription tiers currently — pay-as-you-go top-ups only.

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

- **Landing page:** https://businessaios-web.pskspace.workers.dev
- **API:** https://businessaios-api.pskspace.workers.dev
- **GitHub:** https://github.com/saikaew-pom/businessaios
- **Audit / current status:** [docs/AUDIT.md](./docs/AUDIT.md), [STATUS.md](./STATUS.md)
- **Blueprint:** [BLUEPRINT.md](./BLUEPRINT.md)
- **Deploy guide:** [docs/DEPLOY.md](./docs/DEPLOY.md)

---

**Built with** ❤️ **for Thai SMEs**
