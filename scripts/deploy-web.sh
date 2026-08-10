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
# pipefail is required because `npm run build 2>&1 | tail -10` below is a
# pipeline: without it, `set -e` only sees tail's exit status (always 0,
# since it just reads stdin), so a real build failure would be silently
# swallowed and the script would barrel ahead into `wrangler deploy`.
set -o pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../apps/web"

# Root-cause fix for a real production bug hit 2026-08-10: a normal
# `npm run build` can leave `.svelte-kit/cloudflare-tmp/manifest.js` (what
# the deployed `_worker.js` actually imports its route table from) stale
# relative to `.svelte-kit/output/server/manifest.js` — a brand-new route
# then silently 404s in production even though the build/deploy both
# report success. Wiping the whole `.svelte-kit` directory before every
# build removes the stale-cache possibility entirely, rather than relying
# on remembering to do this by hand whenever a new route was just added.
echo "🧹 Clearing .svelte-kit (prevents a stale route-manifest cache from shipping a 404 for new routes)..."
rm -rf .svelte-kit

echo "🏗️  Building SvelteKit (adapter-cloudflare)..."
npm run build 2>&1 | tail -10

if [ ! -f ".svelte-kit/cloudflare/_worker.js" ]; then
  echo "❌ .svelte-kit/cloudflare/_worker.js not found — build did not produce the expected adapter output"
  exit 1
fi

echo "🚀 Deploying via apps/web-worker (wrangler.toml points at .svelte-kit/cloudflare)..."
cd ../web-worker
npx wrangler deploy

echo ""
echo "🔎 Running post-deploy smoke test..."
"$SCRIPT_DIR/smoke-test.sh" --web-only

echo "✅ Done!"
