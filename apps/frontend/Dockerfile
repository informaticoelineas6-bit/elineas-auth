# syntax=docker/dockerfile:1

# Frontend de administración (TanStack Start). Se construye desde la RAÍZ del
# monorepo (build context = ".") para compartir el lockfile único y resolver los
# workspaces (@elineas/api-client → @elineas/backend). En compose:
#   build: { context: ., dockerfile: apps/frontend/Dockerfile }
#
# El backend se consume como servicio SEPARADO por red; este contenedor solo
# sirve el frontend (SSR + assets). Ver VITE_BACKEND_URL / BACKEND_INTERNAL_URL
# más abajo.

ARG BUN_VERSION=1-alpine

# ---- deps: instala dependencias del frontend (+ sus workspaces) con bun ----
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/backend/package.json ./apps/backend/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter @elineas/frontend

# ---- dev: hot reload con vite dev (bind mount vía docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
WORKDIR /app/apps/frontend
EXPOSE 3000
# `--host` para que vite escuche en 0.0.0.0 y sea alcanzable desde el host.
CMD ["bun", "run", "dev", "--", "--host"]

# ---- build: genera rutas, TYPECHECKEA y produce el bundle (.output de Nitro) ----
# `vite build` SOLO transpila (strip de tipos vía esbuild/rolldown): NO falla
# con errores de TypeScript. Por eso `typecheck` se ejecuta como paso explícito
# y previo — sin él, `docker compose build` pasaría en verde con código roto.
# VITE_BACKEND_URL se "hornea" en el bundle del navegador en tiempo de build,
# así que debe ser la URL PÚBLICA del backend. Se pasa como build-arg.
FROM deps AS build
ARG VITE_BACKEND_URL=http://localhost:8080
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
COPY . .
WORKDIR /app/apps/frontend
RUN bun run generate-routes && bun run typecheck && bun run build

# ---- prod: imagen final mínima con solo el servidor Nitro (preset node-server) ----
# El `.output` de Nitro es autocontenido (empaqueta sus dependencias), por lo que
# la imagen final solo necesita el runtime de Node y esa carpeta.
FROM oven/bun:1 AS prod
ENV NODE_ENV=production
# Nitro node-server escucha en PORT (por defecto 3000).
ENV PORT=3000
WORKDIR /app
COPY --from=build /app/apps/frontend/.output ./.output
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD wget -q -O /dev/null http://localhost:3000/ || exit 1
CMD ["bun", ".output/server/index.mjs"]
