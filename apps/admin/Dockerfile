# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

# ---- base: runtime de node + pnpm, compartido por todas las etapas ----
FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

# ---- deps: instala las dependencias; cacheado mientras no cambien los manifiestos ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- dev: deps + código fuente, hot reload vía bind mount (ver docker-compose.yml) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# ---- build: genera el bundle de producción (server Nitro + assets del cliente) ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- prod-deps: solo dependencias de producción ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---- prod: imagen final, sirve el server Nitro precompilado ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server/index.mjs"]
