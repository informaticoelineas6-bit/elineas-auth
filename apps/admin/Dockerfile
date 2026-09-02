# syntax=docker/dockerfile:1
#
# OJO: el contexto de build es la RAÍZ del monorepo, no este directorio, porque
# el lockfile y los workspaces viven allí. Se construye siempre desde la raíz:
#
#   docker build -f apps/admin/Dockerfile .
#
# docker-compose.yml ya lo hace así (`context: .` + `dockerfile:`).

ARG BUN_VERSION=1-alpine

# ---- base: runtime de bun, compartido por todas las etapas ----
FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- deps: instala las dependencias; cacheado mientras no cambien los manifiestos ----
# `--filter` limita la instalación a esta app y a los paquetes del workspace de
# los que depende. Incluye apps/api porque el panel depende de él como
# devDependency para tipar su cliente RPC: solo se usa el TIPO, pero bun
# necesita el manifiesto para resolver el enlace del workspace.
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY packages/auth-contracts/package.json ./packages/auth-contracts/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter @elineas/auth-admin

# ---- dev: deps + código fuente, hot reload vía bind mount (ver docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY tsconfig.base.json ./
COPY packages/auth-contracts ./packages/auth-contracts
COPY apps/api ./apps/api
COPY apps/admin ./apps/admin
WORKDIR /app/apps/admin
EXPOSE 3000
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

# ---- build: genera el bundle de producción (server Nitro, preset bun) ----
# Necesita las fuentes de apps/api porque `AppType` (el contrato RPC) se resuelve
# desde el código del servidor en tiempo de compilación. Es solo un tipo: se
# borra al transpilar y nada del runtime del servidor entra en el bundle.
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/auth-contracts ./packages/auth-contracts
COPY apps/api ./apps/api
COPY apps/admin ./apps/admin
WORKDIR /app/apps/admin
RUN bun run build

# ---- prod-deps: solo dependencias de producción ----
FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY packages/auth-contracts/package.json ./packages/auth-contracts/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter @elineas/auth-admin

# ---- prod: imagen final, sirve el server Nitro precompilado sobre Bun ----
FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app/apps/admin
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/admin/node_modules /app/apps/admin/node_modules
COPY --from=build /app/apps/admin/.output ./.output
COPY --from=build /app/apps/admin/package.json ./
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
