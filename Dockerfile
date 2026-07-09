# syntax=docker/dockerfile:1

ARG BUN_VERSION=1-alpine

# ---- base: runtime de bun, compartido por todas las etapas ----
FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- deps: instala todo (incluye devDependencies); cacheado mientras no cambie el lockfile ----
FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ---- dev: deps + código fuente, hot reload vía bind mount (ver docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 8080
CMD ["bun", "--env-file=/dev/null", "--watch", "src/index.ts"]

# ---- build: valida tipos (tsc --noEmit) antes de armar la imagen de producción ----
FROM deps AS build
COPY . .
RUN bun run build

# ---- prod-deps: solo dependencias de producción, en una capa separada de deps ----
FROM base AS prod-deps
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

# ---- prod: imagen final, sin devDependencies ni herramientas de build ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./
USER bun
EXPOSE 8080
CMD ["bun", "--env-file=/dev/null", "src/index.ts"]
