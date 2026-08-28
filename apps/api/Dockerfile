# syntax=docker/dockerfile:1

# ---------- builder ----------
FROM node:22-alpine AS builder
# Non-interactive corepack: it must fetch the pinned pnpm without prompting.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Manifests first so the dependency layer is cached independently of source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @pt/api... --filter @pt/shared...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @pt/shared build \
  && pnpm --filter @pt/api exec prisma generate \
  && pnpm --filter @pt/api build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production

# pnpm keeps real packages in /app/node_modules/.pnpm and symlinks per workspace, so the
# store and every workspace node_modules must travel together. Kept whole on purpose:
# `prisma migrate deploy` at boot needs the Prisma CLI that a --prod prune would drop.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=node:node /app/apps/api/tsconfig.json ./apps/api/

COPY --chmod=0755 apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
