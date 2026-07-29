# Deploy MarketingAiOs to Cloudflare

> Step-by-step guide to deploy both frontend and backend to Cloudflare.
> **Time:** ~30 minutes (one-time) · **Cost:** Free tier covers 0-1,000 users

---

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] Cloudflare account (free): https://dash.cloudflare.com/sign-up
- [ ] `wrangler` CLI installed: `npm i -g wrangler`
- [ ] Resend account for email (free): https://resend.com

---

## Step 1: Login to Cloudflare

```bash
wrangler login
```

A browser tab will open. Login and authorize wrangler.

Verify:
```bash
wrangler whoami
```

---

## Step 2: Create D1 Database

```bash
cd apps/api
wrangler d1 create marketingaios-db
```

Copy the `database_id` from the output. Open `apps/api/wrangler.toml` and replace:
```toml
database_id = "REPLACE_AFTER_CREATE"
```
with the actual ID.

---

## Step 3: Apply Database Migrations

```bash
# Local (for testing)
wrangler d1 migrations apply marketingaios-db --local

# Production
wrangler d1 migrations apply marketingaios-db --remote
```

---

## Step 4: Set Secrets

```bash
# Resend API key (for sending notification emails)
wrangler secret put RESEND_API_KEY
# Paste your Resend API key from https://resend.com/api-keys

# Notification email (where to send waitlist signups)
# Edit wrangler.toml and replace REPLACE_WITH_YOUR_EMAIL
# Then deploy (or just set as var)
```

To get a Resend API key:
1. Go to https://resend.com/sign-up
2. Verify your domain (or use their test domain)
3. Create an API key
4. Copy the key (starts with `re_`)

---

## Step 5: Update `wrangler.toml`

Edit `apps/api/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGIN = "https://marketingaios.pages.dev"  # Your Pages URL
RESEND_FROM_EMAIL = "waitlist@yourdomain.com"      # Must be verified in Resend
NOTIFY_EMAIL = "you@youremail.com"                  # Where to send notifications
```

---

## Step 6: Deploy API

```bash
cd apps/api
wrangler deploy
```

You'll get a URL like: `https://marketingaios-api.YOUR-SUBDOMAIN.workers.dev`

Test it:
```bash
curl https://marketingaios-api.YOUR-SUBDOMAIN.workers.dev/health
```

Should return: `{"status":"ok",...}`

---

## Step 7: Configure Web App

```bash
cd ../web
cp .env.example .env
```

Edit `.env`:
```
PUBLIC_API_URL=https://marketingaios-api.YOUR-SUBDOMAIN.workers.dev
```

---

## Step 8: Deploy Web to Cloudflare Pages

### Option A: Direct from CLI

```bash
npm run build
npm run deploy
```

This will create the Pages project on first run.

### Option B: Via Cloudflare Dashboard

1. Go to https://dash.cloudflare.com → Pages
2. Create a project → Connect to Git
3. Build command: `npm run build`
4. Build output: `.svelte-kit/output/cloudflare`
5. Environment variables: `PUBLIC_API_URL=https://marketingaios-api.YOUR-SUBDOMAIN.workers.dev`
6. Deploy

---

## Step 9: Update CORS

After deploying web, go back to `apps/api/wrangler.toml` and update:
```toml
ALLOWED_ORIGIN = "https://marketingaios.pages.dev"
```

Then redeploy API:
```bash
cd apps/api
wrangler deploy
```

---

## Step 10: Verify Everything

1. Visit `https://marketingaios.pages.dev`
2. Click "Join Waitlist"
3. Enter email → submit
4. Check:
   - [ ] Form submits without error
   - [ ] Confirmation message shows
   - [ ] You receive email at NOTIFY_EMAIL
   - [ ] Row added to D1 (check with `wrangler d1 execute marketingaios-db --remote --command "SELECT * FROM waitlist"`)

---

## 🔧 Useful Commands

```bash
# Tail logs
wrangler tail

# Query D1
wrangler d1 execute marketingaios-db --remote --command "SELECT * FROM waitlist"

# Delete all waitlist (be careful!)
wrangler d1 execute marketingaios-db --remote --command "DELETE FROM waitlist"

# Update a secret
wrangler secret put RESEND_API_KEY

# List secrets
wrangler secret list
```

---

## 🚨 Troubleshooting

### CORS error

Make sure `ALLOWED_ORIGIN` in API `wrangler.toml` matches your Pages URL exactly.

### Email not sending

1. Check `RESEND_API_KEY` is set: `wrangler secret list`
2. Verify domain in Resend dashboard
3. Check logs: `wrangler tail`

### Database not found

Make sure `database_id` in `wrangler.toml` is correct:
```bash
wrangler d1 list
```

### Build fails

```bash
cd apps/web
rm -rf .svelte-kit
npm run build
```

---

## 📈 Next Steps

After deploying:

1. **Set up domain** (optional):
   - Buy domain (e.g., from Cloudflare Registrar)
   - Add custom domain in Pages dashboard
   - Update `ALLOWED_ORIGIN` in API

2. **Set up Stripe** (Phase 2):
   - Create Stripe account
   - Add `STRIPE_SECRET_KEY` to secrets
   - Implement subscription flow

3. **Set up Clerk** (Phase 2):
   - Create Clerk app
   - Add `CLERK_SECRET_KEY` to secrets
   - Integrate auth in SvelteKit

4. **Monitor**:
   - Cloudflare Analytics (built-in)
   - PostHog (recommended)
   - Sentry (error tracking)

---

## 💡 Tips

- **Free tier limits:**
  - Workers: 100,000 req/day
  - D1: 5M reads + 100K writes/day
  - R2: 10GB storage + 10M reads/month
  - Pages: Unlimited requests

- **When you outgrow free tier:**
  - Workers Paid: $5/mo for 10M req
  - D1 Paid: $5/mo for 25M reads

- **Backup:**
  ```bash
  wrangler d1 export marketingaios-db --remote --output=backup-$(date +%Y%m%d).sql
  ```

---

**Need help?** Check the [Cloudflare Discord](https://discord.gg/cloudflaredev) or open an issue.
