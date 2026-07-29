#!/bin/bash
# BusinessAiOs Web Deploy Script
# Builds SvelteKit + copies to dist-deploy + deploys to Cloudflare

set -e
cd "$(dirname "$0")/../apps/web"

echo "🧹 Cleaning previous build..."
mavis-trash .svelte-kit dist-deploy/_app 2>/dev/null || true

echo "🏗️  Building SvelteKit..."
npm run build 2>&1 | tail -5

echo "📦 Copying client assets to dist-deploy..."
cp -R .svelte-kit/output/client/. dist-deploy/

# Find the build hash and entry file names
HASH=$(grep -hoE "__sveltekit_[a-z0-9]+" .svelte-kit/output/client/_app/immutable/chunks/*.js | sort -u | head -1)
ENTRY_APP=$(ls .svelte-kit/output/client/_app/immutable/entry/app.*.js | head -1 | xargs basename)
ENTRY_START=$(ls .svelte-kit/output/client/_app/immutable/entry/start.*.js | head -1 | xargs basename)

if [ -z "$HASH" ] || [ -z "$ENTRY_APP" ] || [ -z "$ENTRY_START" ]; then
  echo "❌ Failed to detect build artifacts (hash=$HASH app=$ENTRY_APP start=$ENTRY_START)"
  exit 1
fi

echo "🔧 Build hash: $HASH"
echo "   Entry: $ENTRY_START + $ENTRY_APP"

# Write a proper SPA bootstrap index.html with the correct hash
cat > dist-deploy/index.html << HTML
<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#3b82f6" />
    <title>BusinessAiOs — Operating System for AI Business</title>
    <meta name="description" content="Generate Brand Card, Persona, Content Calendar, Workflow and KPI Dashboard with AI." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="modulepreload" href="/_app/immutable/entry/$ENTRY_START">
    <link rel="modulepreload" href="/_app/immutable/entry/$ENTRY_APP">
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">
      <script>
        {
          $HASH = {
            base: ""
          };
          const element = document.currentScript.parentElement;
          Promise.all([
            import("/_app/immutable/entry/$ENTRY_START"),
            import("/_app/immutable/entry/$ENTRY_APP")
          ]).then(([kit, app]) => {
            kit.start(app, element);
          });
        }
      </script>
    </div>
  </body>
</html>
HTML

echo "🚀 Deploying to Cloudflare Workers..."
cd ../web-worker
CLOUDFLARE_ACCOUNT_ID=8d3b88fb762aaac5e9feca0421310dfb npx wrangler deploy 2>&1 | tail -5

echo "✅ Done!"
