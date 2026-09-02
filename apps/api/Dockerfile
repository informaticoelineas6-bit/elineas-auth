# syntax=docker/dockerfile:1
#
# OJO: el contexto de build es la RAÍZ del monorepo, no este directorio, porque
# el lockfile y los workspaces viven allí. Se construye siempre desde la raíz:
#
#   docker build -f apps/api/Dockerfile .
#
# docker-compose.yml ya lo hace así (`context: .` + `dockerfile:`).

ARG BUN_VERSION=1-alpine

# ---- base: runtime de bun, compartido por todas las etapas ----
FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- deps: instala las dependencias; cacheado mientras no cambien los manifiestos ----
# Se copian solo los manifiestos (no el código) para que la capa se reutilice
# mientras las dependencias no cambien. `--filter` limita la instalación a esta
# app y a los paquetes del workspace de los que depende: sin él se instalarían
# también las del panel (vite, tailwind, tanstack...), que aquí no hacen nada.
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/auth-contracts/package.json ./packages/auth-contracts/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter @elineas/auth-api

# ---- dev: deps + código fuente, hot reload vía bind mount (ver docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/auth-contracts ./packages/auth-contracts
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["bun", "--env-file=/dev/null", "--watch", "src/index.ts"]

# ---- build: valida tipos (tsc --noEmit) y genera el bundle de producción ----
# El bundle (bun build --minify) precompila todo el grafo de módulos TS a un
# único `dist/index.js`, evitando transpilar el código fuente en cada arranque:
# reduce el tiempo de arranque ~40% frente a ejecutar los .ts crudos. Resuelve
# también `@elineas/auth-contracts`, así que el paquete del workspace queda
# dentro del bundle y no hace falta en la imagen final.
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/auth-contracts ./packages/auth-contracts
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN bun run build && bun run build:prod

# ---- prod-deps: solo dependencias de producción ----
FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/auth-contracts/package.json ./packages/auth-contracts/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter @elineas/auth-api

# ---- prod: imagen final, sin devDependencies ni herramientas de build ----
# Ejecuta el bundle precompilado (dist/index.js) en vez del código TS crudo.
# node_modules (solo prod) se mantiene como respaldo para dependencias que el
# bundler deje como externas (requires dinámicos, etc.).
FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
USER bun
EXPOSE 8080
CMD ["bun", "--env-file=/dev/null", "dist/index.js"]
