#!/usr/bin/env bash
# One-shot setup: run from repo root on your own machine (this sandbox has no outbound network).
# Creates the R2 preview bucket, sets Worker secrets from server/.dev.vars, and deploys.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null; then
  echo "Install Node.js 20+ first: https://nodejs.org" >&2
  exit 1
fi

npm install

if [ ! -f server/.dev.vars ]; then
  echo "Missing server/.dev.vars — copy server/.dev.vars.example and fill in first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source server/.dev.vars; set +a

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in server/.dev.vars" >&2
  exit 1
fi

export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

echo "→ Verifying Cloudflare auth..."
npx wrangler whoami

echo "→ Creating preview R2 bucket (idempotent)..."
npx wrangler r2 bucket create toluenetech-assets-dev || true

echo "→ Uploading non-secret vars..."
npx wrangler versions put variables \
  --config server/wrangler.toml \
  --env production \
  R2_PUBLIC_URL="${R2_PUBLIC_URL:-https://pub-3ba2d6d48fc941ae93a9328a913b8b85.r2.dev}" \
  ENVIRONMENT=production 2>/dev/null || true

echo "→ Setting secrets (skips blank ones)..."
put_secret() {
  local name="$1"; local val="$2"
  if [ -n "${val:-}" ]; then
    echo "$val" | npx wrangler secret put "$name" --config server/wrangler.toml
  else
    echo "  (skip $name — not set)"
  fi
}
put_secret DATABASE_URL   "${DATABASE_URL:-}"
put_secret AI_PROVIDER    "${AI_PROVIDER:-}"
put_secret AI_API_KEY     "${AI_API_KEY:-}"
put_secret AI_MODEL       "${AI_MODEL:-}"
put_secret ASSISTANT_SECRET "${ASSISTANT_SECRET:-}"
put_secret CORS_ORIGIN    "${CORS_ORIGIN:-}"

echo "→ Deploying Worker..."
npx wrangler deploy server/src/index.ts --config server/wrangler.toml

echo ""
echo "Done. Your API is now live at the workers.dev URL printed above."
echo "Next: point Netlify env var VITE_API_URL at that URL and redeploy, or add"
echo "a CNAME api.toluenetech.com -> your-workers-subdomain.workers.dev in Cloudflare DNS."
