#!/bin/sh
set -eu

./node_modules/.bin/prisma migrate deploy --schema database/prisma/schema.prisma

if [ "${SEED_DEMO:-false}" = "true" ]; then
  ./node_modules/.bin/tsx database/prisma/seed.ts
fi

exec node backend/dist/main.js
