#!/bin/bash
# Business Smart OS — Web Deploy Script
#
# Builds the real SvelteKit + adapter-cloudflare output (a full SSR worker,
# `.svelte-kit/cloudflare/_worker.js` + its static assets) and deploys it
# via apps/web-worker, whose wrangler.toml points `main`/`[assets]` at that
# build output directly.
#
# Do NOT go back to hand-writing a client-only "SPA shell" index.html and
# dynamic-importing start.js/app.js yourself (an earlier version of this
# script, and apps/web-worker/src/index.ts, both did this) — this app is
# NOT a static/CSR-only build (svelte.config.js uses adapter-cloudflare
# with routes.include=['/*'], i.e. real SSR), so its client bundle expects
# genuine SSR hydration data on the initial response. A hand-written shell
# can load every JS chunk successfully and still fail to mount at all
# (blank page, no console error) because svelte-kit's client runtime
# expects handshake data. Found live in production 2026-07-29: the app
# never rendered — see docs root cause note in git history around that
# date if this ever needs re-diagnosing.

set -e
cd "$(dirname "$0")/../apps/web"

echo "🏗️  Building SvelteKit (adapter-cloudflare)..."
npm run build 2>&1 | tail -10

if [ ! -f ".svelte-kit/cloudflare/_worker.js" ]; then
  echo "❌ .svelte-kit/cloudflare/_worker.js not found — build did not produce the expected adapter output"
  exit 1
fi

echo "🚀 Deploying via apps/web-worker (wrangler.toml points at .svelte-kit/cloudflare)..."
cd ../web-worker
npx wrangler deploy

echo "✅ Done!"
