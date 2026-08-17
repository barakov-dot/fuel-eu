# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.13.0-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @fuelmap/web...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_MAP_STYLE_URL=${NEXT_PUBLIC_MAP_STYLE_URL}
ENV NODE_ENV=production

WORKDIR /app/apps/web
RUN pnpm build

FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter @fuelmap/web...

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 fuelmap \
  && useradd --system --uid 1001 --gid fuelmap fuelmap

COPY --from=prod-deps --chown=fuelmap:fuelmap /app/node_modules ./node_modules
COPY --from=prod-deps --chown=fuelmap:fuelmap /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build --chown=fuelmap:fuelmap /app/apps/web/.next ./apps/web/.next
COPY --from=build --chown=fuelmap:fuelmap /app/apps/web/public ./apps/web/public
COPY --chown=fuelmap:fuelmap apps/web/package.json ./apps/web/package.json

USER fuelmap
WORKDIR /app/apps/web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

CMD ["./node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
