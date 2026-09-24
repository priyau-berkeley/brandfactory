#!/usr/bin/env bash
# Builds (1) a static front end for the preview host into out/, then (2) the full Next.js app
# (pages + API routes) into .next for `next start`. Order matters: both builds touch .next.
set -euo pipefail
cd "$(dirname "$0")/.."
mv app/api /tmp/variant-sprint-api
restore() { [ -d /tmp/variant-sprint-api ] && mv /tmp/variant-sprint-api app/api || true; }
trap restore EXIT
rm -rf out .next-export
STATIC_EXPORT=1 NEXT_PUBLIC_API_BASE=__PORT_3000__ npx next build
cp -r .next-export out
restore
npx next build
