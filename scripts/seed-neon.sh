#!/usr/bin/env bash
# Seeds Neon with baseline site_settings so the assistant knows the current availability.
# Run AFTER migrate-neon.sh. Idempotent — uses ON CONFLICT DO UPDATE.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f server/.dev.vars ]; then
  echo "Missing server/.dev.vars" >&2; exit 1
fi
set -a; source server/.dev.vars; set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set" >&2; exit 1
fi

export DATABASE_URL
node --input-type=module -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const settings = [
  ['availability', JSON.stringify('AVAILABLE')],
  ['studio_name',    JSON.stringify('Toluene Tech')],
  ['location',       JSON.stringify('Lagos, Nigeria — working remotely with clients worldwide')],
  ['response_time',  JSON.stringify('within a few hours on business days')],
];

for (const [k, v] of settings) {
  await sql\`INSERT INTO site_settings (key, value) VALUES (\${k}, \${v}::jsonb)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()\`;
  console.log('  set', k);
}
console.log('Done.');
"
