# syntax=docker/dockerfile:1

# Este Dockerfile se construye desde la RAÍZ del monorepo (build context = ".")
# para que el lockfile único (bun.lock) y los manifiestos de los workspaces
# resuelvan igual que en local. En compose:
#   build: { context: ., dockerfile: apps/backend/Dockerfile }

ARG BUN_VERSION=1-alpine

# ---- base: runtime de bun, compartido por todas las etapas ----
FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- deps: instala las dependencias del backend; cacheado mientras no cambien los manifiestos ----
# Se copian solo los package.json (raíz + workspace backend) + el lockfile para
# que la capa de instalación se reutilice mientras las dependencias no cambien,
# aunque sí cambie el código fuente.
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter @elineas/backend

# ---- dev: deps + código fuente, hot reload vía bind mount (ver docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
WORKDIR /app/apps/backend
EXPOSE 8080
CMD ["bun", "--env-file=/dev/null", "--watch", "src/index.ts"]

# ---- build: valida tipos (tsc --noEmit) y genera el bundle de producción ----
# El bundle (bun build --minify) precompila todo el grafo de módulos TS a un
# único `dist/index.js`, evitando transpilar el código fuente en cada arranque:
# reduce el tiempo de arranque ~40% frente a ejecutar los .ts crudos.
FROM deps AS build
COPY . .
WORKDIR /app/apps/backend
RUN bun run build && bun run build:prod

# ---- prod-deps: solo dependencias de producción del backend ----
FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter @elineas/backend

# ---- prod: imagen final, sin devDependencies ni herramientas de build ----
# Ejecuta el bundle precompilado (dist/index.js) en vez del código TS crudo.
# node_modules (solo prod) se mantiene como respaldo para dependencias que el
# bundler deje como externas (requires dinámicos, etc.).
FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app/apps/backend
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./
USER bun
EXPOSE 8080
CMD ["bun", "--env-file=/dev/null", "dist/index.js"]
