#!/usr/bin/env bash
# Apply Drizzle migrations against your Neon database.
# Requires DATABASE_URL in server/.dev.vars.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f server/.dev.vars ]; then
  echo "Missing server/.dev.vars" >&2; exit 1
fi
set -a; source server/.dev.vars; set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set in server/.dev.vars" >&2; exit 1
fi

export DATABASE_URL
echo "→ Generating SQL migrations..."
npx drizzle-kit generate --config server/drizzle.config.ts
echo "→ Applying migrations to Neon..."
npx drizzle-kit migrate  --config server/drizzle.config.ts
echo "Done."
