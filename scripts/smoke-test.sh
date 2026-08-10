#!/bin/bash
# Business Smart OS — Post-deploy smoke test
#
# Root-cause fix for a real production bug hit 2026-08-10: a normal
# `npm run build` inside apps/web can leave `.svelte-kit/cloudflare-tmp/
# manifest.js` (what the deployed `_worker.js` actually imports its route
# table from) stale relative to `.svelte-kit/output/server/manifest.js` —
# a brand-new route (e.g. /shop) then silently 404s in production even
# though the deploy itself reports success. Caught only because someone
# happened to curl the new route by hand afterward. This script makes that
# manual check automatic and mandatory instead of a thing to remember.
#
# Usage:
#   scripts/smoke-test.sh              # check both API and web
#   scripts/smoke-test.sh --api-only
#   scripts/smoke-test.sh --web-only
#
# Env overrides (for staging/local use):
#   API_URL, WEB_URL

set -u

API_URL="${API_URL:-https://businessaios-api.pskspace.workers.dev}"
WEB_URL="${WEB_URL:-https://businessaios-web.pskspace.workers.dev}"

CHECK_API=1
CHECK_WEB=1
case "${1:-}" in
  --api-only) CHECK_WEB=0 ;;
  --web-only) CHECK_API=0 ;;
esac

# Every "4 ที่" bottom-nav destination plus the advanced-menu surfaces most
# likely to regress silently (a new route added under one of them, or a
# route whose feature flag/build step breaks) — not exhaustive, but this
# exact set is what caught the /shop stale-manifest bug and has been
# hand-run after every deploy since.
WEB_ROUTES=(/today /create /calendar /shop /works /inbox /admin)

failures=0

check() {
  local url="$1"
  local expect="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  if [ "$code" = "$expect" ]; then
    echo "  ✅ $url -> $code"
  else
    echo "  ❌ $url -> $code (expected $expect)"
    failures=$((failures + 1))
  fi
}

if [ "$CHECK_API" = "1" ]; then
  echo "🔎 API smoke test ($API_URL)"
  check "$API_URL/health" 200
fi

if [ "$CHECK_WEB" = "1" ]; then
  echo "🔎 Web smoke test ($WEB_URL)"
  for route in "${WEB_ROUTES[@]}"; do
    check "$WEB_URL$route" 200
  done
fi

if [ "$failures" -gt 0 ]; then
  echo ""
  echo "❌ Smoke test failed: $failures route(s) did not return the expected status."
  echo "   If a route that should exist 404s right after a web deploy, this is almost"
  echo "   certainly the stale .svelte-kit manifest bug — rm -rf apps/web/.svelte-kit"
  echo "   and redeploy (scripts/deploy-web.sh already does this automatically)."
  exit 1
fi

echo ""
echo "✅ Smoke test passed."
