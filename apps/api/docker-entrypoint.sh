#!/bin/sh
set -e

# Call the Prisma CLI binary directly. Going through pnpm would trigger its dependency
# status check, which runs an install the runtime image neither needs nor can write.
API_DIR=/app/apps/api
PRISMA="$API_DIR/node_modules/.bin/prisma"

# Single-instance deploy: applying migrations at boot is the simplest correct order.
# Set RUN_MIGRATIONS=false once you move to more than one API replica.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "==> prisma migrate deploy"
  (cd "$API_DIR" && "$PRISMA" migrate deploy)
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "==> prisma db seed"
  (cd "$API_DIR" && "$PRISMA" db seed)
fi

exec "$@"
