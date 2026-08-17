# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.13.0-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @fuelmap/api...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api ./apps/api
RUN pnpm --filter @fuelmap/api build

FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @fuelmap/api...

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3001

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 fuelmap \
  && useradd --system --uid 1001 --gid fuelmap fuelmap

COPY --from=prod-deps --chown=fuelmap:fuelmap /app/node_modules ./node_modules
COPY --from=prod-deps --chown=fuelmap:fuelmap /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=fuelmap:fuelmap /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=fuelmap:fuelmap /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build --chown=fuelmap:fuelmap /app/apps/api/package.json ./apps/api/package.json

RUN mkdir -p /app/data/uploads /app/data/tesseract-cache \
  && chown -R fuelmap:fuelmap /app/data

USER fuelmap
WORKDIR /app/apps/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${API_PORT}/api/ready" || exit 1

CMD ["node", "dist/src/main.js"]
