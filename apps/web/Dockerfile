# syntax=docker/dockerfile:1

# ---------- builder ----------
FROM node:22-alpine AS builder
# Non-interactive corepack: it must fetch the pinned pnpm without prompting.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @pt/web... --filter @pt/shared...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN pnpm --filter @pt/shared build && pnpm --filter @pt/web build

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
