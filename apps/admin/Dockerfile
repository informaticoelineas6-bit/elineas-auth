# syntax=docker/dockerfile:1

ARG BUN_VERSION=1-alpine

# ---- base: runtime de bun, compartido por todas las etapas ----
FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- deps: instala las dependencias; cacheado mientras no cambien los manifiestos ----
FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ---- dev: deps + código fuente, hot reload vía bind mount (ver docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

# ---- build: genera el bundle de producción (server Nitro, preset bun) ----
FROM deps AS build
COPY . .
RUN bun run build

# ---- prod-deps: solo dependencias de producción ----
FROM base AS prod-deps
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

# ---- prod: imagen final, sirve el server Nitro precompilado sobre Bun ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
