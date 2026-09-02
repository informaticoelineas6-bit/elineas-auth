# syntax=docker/dockerfile:1
#
# OJO: el contexto de build es la RAÍZ del monorepo, no este directorio, porque
# el lockfile y los workspaces viven allí. Se construye siempre desde la raíz:
#
#   docker build -f apps/frontend/Dockerfile .
#
# docker-compose.yml ya lo hace así (`context: .` + `dockerfile:`).

ARG BUN_VERSION=1-alpine

# ---- base: runtime de bun, compartido por todas las etapas ----
FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- deps: instala las dependencias; cacheado mientras no cambien los manifiestos ----
# `--filter` limita la instalación a esta app y a los paquetes del workspace de
# los que depende. Incluye apps/backend porque el panel depende de él como
# devDependency para tipar su cliente RPC: solo se usa el TIPO, pero bun
# necesita el manifiesto para resolver el enlace del workspace.
#
# El `ln` de después del install NO es cosmético: `nitro-nightly` (el paquete
# real detrás del alias "nitro" de apps/frontend/package.json) se publica con
# su propio package.json llamado literalmente "nitro-nightly", así que su
# código NO puede auto-referenciarse — su `dist/vite.mjs` importa el bare
# specifier "nitro/meta" esperando encontrar un symlink `node_modules/nitro`
# subiendo por los ancestros del archivo. Con un `bun install` SIN `--filter`
# (como el que corre en el host, o `bun install` a secas) bun hoistea ese
# symlink hasta la RAÍZ del workspace (/app/node_modules/nitro) sin que haga
# falta nada más. Pero `--filter @elineas/auth-frontend` deja el symlink
# aislado en apps/frontend/node_modules/nitro y NUNCA lo sube a la raíz — y la
# resolución de "nitro/meta" desde dentro del store compartido de bun
# (node_modules/.bun/nitro-nightly@.../…) solo mira hacia /app/node_modules,
# no hacia apps/frontend/node_modules. Sin este symlink, `vite dev`/`vite
# build` fallan con "Cannot find package 'nitro'" y, bajo
# `restart: unless-stopped` de compose, el contenedor entra en bucle de
# reinicio. Verificado contra ambas rutas de resolución con `bun.lock`
# reinstalado desde cero.
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/auth-contracts/package.json ./packages/auth-contracts/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter @elineas/auth-frontend && \
    ln -sf ../apps/frontend/node_modules/nitro /app/node_modules/nitro

# ---- dev: deps + código fuente, hot reload vía bind mount (ver docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY tsconfig.base.json ./
COPY packages/auth-contracts ./packages/auth-contracts
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

# ---- build: genera el bundle de producción (server Nitro, preset bun) ----
# Necesita las fuentes de apps/backend porque `AppType` (el contrato RPC) se resuelve
# desde el código del servidor en tiempo de compilación. Es solo un tipo: se
# borra al transpilar y nada del runtime del servidor entra en el bundle.
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/auth-contracts ./packages/auth-contracts
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
RUN bun run build

# ---- prod-deps: solo dependencias de producción ----
FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/auth-contracts/package.json ./packages/auth-contracts/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter @elineas/auth-frontend

# ---- prod: imagen final, sirve el server Nitro precompilado sobre Bun ----
FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app/apps/frontend
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/frontend/node_modules /app/apps/frontend/node_modules
COPY --from=build /app/apps/frontend/.output ./.output
COPY --from=build /app/apps/frontend/package.json ./
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
