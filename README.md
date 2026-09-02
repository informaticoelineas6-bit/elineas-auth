# Elineas Auth — monorepo

Identity server de Mercado Elineas y su panel de administración, en un único
repositorio con workspaces de bun.

```
apps/
  backend/             Identity server (Hono + better-auth + Drizzle, sobre Bun)
  frontend/            Panel de administración (TanStack Start + React + Vite)
packages/
  auth-contracts/      Reglas de validación compartidas por ambos
```

Antes eran dos repos (`elineas-auth` y `elineas-auth-frontend`). Se unificaron
porque el panel es un cliente del identity server y nada garantizaba que fueran
acordes: las reglas de validación estaban escritas dos veces y habían
divergido de verdad (ver [El contrato compartido](#el-contrato-compartido)).

El historial de los dos proyectos se conserva completo: `git log` y `git blame`
funcionan sobre los 182 commits, también los anteriores a la unificación.

## Empezar

```bash
bun install                 # una sola vez, instala los tres workspaces
docker compose up -d        # postgres + redis + maildev + backend + frontend
```

O sin Docker, con la infraestructura en contenedores y las apps en el host:

```bash
docker compose up -d postgres redis maildev
bun run db:migrate:local
bun run db:seed:local
bun run dev:backend             # http://localhost:8080
bun run dev:frontend           # http://localhost:3000
```

Variables de entorno: copia las plantillas y rellénalas.

```bash
cp apps/backend/.env.example    apps/backend/.env.local
cp apps/frontend/.env.example  apps/frontend/.env
```

`AUTH_API_URL` del panel tiene que apuntar al `BETTER_AUTH_URL` de la API, y el
`AUTH_SYSTEM_SLUG` del panel debe existir como sistema en el IS con al menos un
rol asignado al usuario que inicie sesión; si no, el login responde 403.

## Scripts (desde la raíz)

| Script | Qué hace |
| --- | --- |
| `bun run dev` | Arranca API y panel a la vez |
| `bun run dev:backend` / `dev:frontend` | Solo una de las dos |
| `bun run typecheck` | `tsc --noEmit` en cada workspace |
| `bun run test` | Pruebas de todos los workspaces |
| `bun run lint` | Biome sobre todo el repo |
| `bun run format` | Biome formatea (escribe) |
| `bun run build` | Build de producción de las dos apps |
| `bun run db:migrate:local` | Migraciones de Drizzle |
| `bun run db:seed:local` | Siembra de datos |
| `bun run openapi:generate` | Regenera `apps/backend/postman/*.openapi.json` |

Los scripts delegan en cada workspace con `bun run --filter`, así que también
puedes entrar en `apps/backend` o `apps/frontend` y usar sus scripts directamente.

## El contrato compartido

`packages/auth-contracts` es la **única** definición de las reglas que el
servidor y el panel tienen que aplicar igual: política de contraseña, dominio
corporativo, límites de paginación y campos de negocio. Antes vivían en
`apps/backend/src/openapi/*.schemas.ts` y en `apps/frontend/src/modules/*/lib/validation.ts`
por separado, y habían divergido:

| Regla | Servidor (antes) | Panel (antes) | Consecuencia |
| --- | --- | --- | --- |
| Contraseña nueva | `min(12).max(128)` | + mayúscula, minúscula y especial | Una llamada directa a la API fijaba contraseñas que el panel jamás habría aceptado |
| Contraseña de login | `min(1).max(128)` | `min(12).max(128)` | El panel **bloqueaba** cuentas con contraseña de <12 caracteres: no podían entrar ni cambiarla |
| Paginación | `max(100)`, defecto 20 | ídem, duplicado | Se desincronizaban en silencio |

Ahora la política estricta la aplican los dos extremos, y el login es permisivo
en ambos (ahí no se valida una política: se compara contra el hash guardado).
`packages/auth-contracts/src/primitives.test.ts` fija estos casos.

El paquete exporta **solo zod y helpers sin dependencias de runtime**: nada de
Hono, ni `@hono/zod-openapi`, ni `libphonenumber-js`. Así lo pueden importar el
servidor (Bun) y el panel (navegador) sin arrastrar nada de uno al otro.

Los tipos de **respuesta** no están aquí: se derivan del grafo de rutas real del
servidor vía `AppType`, que expone `@elineas/auth-backend/rpc`.

## Cliente RPC tipado

`apps/frontend/src/modules/common/lib/rpc.ts` construye un cliente por grupo de
rutas con `hc<...>` de Hono. La ruta, el método, el cuerpo y la respuesta los
deriva TypeScript del servidor, así que un cambio en la API **rompe la
compilación del panel** en lugar de aparecer en producción.

`@elineas/auth-backend` está en `devDependencies` del panel a propósito: solo se usa
su TIPO. El build lo verifica — no hay rastro de `drizzle-orm`, `better-auth`,
`pg`, `nodemailer` ni `resend` en el bundle del panel.

### Migrar los módulos que quedan

El módulo `users` está migrado como patrón de referencia. Los otros siete
(`employees`, `roles`, `systems`, `sessions`, `user-roles`, `auth`, `common`)
siguen usando el cliente antiguo `isApi` de
`apps/frontend/src/modules/common/lib/api-client.ts` y sus tipos escritos a mano.
Funcionan; se migran uno a uno así:

1. En `<módulo>/services/*.ts`, cambia `isApi.get<T>("/api/x")` por el cliente
   del grupo: `unwrap(xRpc.….$get({ … }))`.
2. En `<módulo>/shared/types.ts`, sustituye cada tipo de respuesta escrito a
   mano por `InferResponseType<typeof xRpc.….$get, 200>`.
3. En `<módulo>/lib/validation.ts`, importa de `@elineas/auth-contracts` toda
   regla que el servidor también aplique.
4. `bun run typecheck`.

Cuando no quede ningún consumidor, borra `api-client.ts`.

## Convenciones

- **Alias de imports.** El panel usa `#/*` (y `@/*`) para su propio `src`. El
  backend usa `@backend/*`. El prefijo del backend es distinto **a propósito**: al
  importar `AppType`, TypeScript compila las fuentes del backend dentro del
  programa del panel y resuelve sus alias con el tsconfig del panel; como ambas
  apps tienen un `src/routes/`, con `@/*` en las dos `@/routes` apuntaba al
  árbol equivocado y `AppType` degeneraba en `unknown` sin un solo error.
- **Formato.** Biome, configurado en `biome.jsonc` (con `c`: `biome.json` no
  admite comentarios y los ignora en silencio). El linter cubre todo el repo;
  el formateo respeta el estilo de cada app — 2 espacios en `apps/backend` y
  `packages/*`, tabuladores en `apps/frontend` — para no reformatear 78 archivos
  del backend y romper su `git blame`.
- **TypeScript.** `tsconfig.base.json` tiene lo común; cada workspace añade solo
  lo de su entorno. No hay un `tsc` único desde la raíz: la API compila contra
  los tipos de Bun (sin DOM) y el panel contra los del navegador, y cada uno
  fija su propia versión (7.0.2 y 6.0.3). `bun run typecheck` delega en cada uno.
- **Migraciones y esquemas generados** (`apps/backend/src/db/migrations/`,
  `auth-schema.ts`) y los **componentes de shadcn** vendorizados
  (`apps/frontend/src/modules/common/components/ui/`) quedan fuera del linter: se
  regeneran, y corregirlos solo crea divergencias.

## Trampas conocidas

- **`nitro` se declara también en el `package.json` de la raíz.** Es un alias de
  `npm:nitro-nightly`, así que el paquete real en disco se llama
  `nitro-nightly`, pero sus propios `.d.mts` se autoimportan como
  `"nitro/types"`. TypeScript resuelve los symlinks a su ruta real y busca
  `node_modules/nitro` hacia arriba desde el store de bun, donde el alias ya no
  está. Sin la declaración en la raíz, `NitroConfig` no resuelve y
  `apps/frontend/vite.config.ts` deja de compilar.
- **Un cliente RPC por grupo de rutas, no uno solo sobre `AppType`.**
  `hc<AppType>` pierde los hijos de un nodo que es a la vez hoja y rama, y
  `/api/users/me` lo es: tiene GET y PATCH propios más `/me/change-password` y
  `/me/change-email`.
- **`$get({ param: {} })` en rutas sin parámetros.** `@hono/zod-openapi` incluye
  siempre `param` en el tipo de entrada y Hono lo marca como obligatorio. En
  runtime no añade nada.
- **El campo `imports` de package.json no sirve para el alias del backend.**
  Sería más limpio que `paths` (lo resuelve el paquete que lo declara), pero bun
  1.4.0 no lo resuelve de forma fiable: importar dos nombres del mismo módulo
  falla donde cada uno por separado funciona.

## Deuda pendiente

- **Filas antiguas con CI fuera de formato.** La regla de 11 dígitos ya la
  aplican los dos extremos. Si en la base de datos hubiera CIs con otro
  formato, se pueden listar y consultar sin problema, pero editar esa ficha
  fallaría con 400 al reenviar el CI. Para localizarlas:
  ```sql
  SELECT id, ci FROM employee WHERE ci IS NOT NULL AND ci !~ '^[0-9]{11}$';
  ```
- **Formato pendiente en código preexistente**: 30 archivos en `apps/backend` (que
  nunca tuvo linter) y 7 en `apps/frontend`. `bun run format` los arregla de golpe;
  se dejó sin hacer para que el diff de la unificación fuera revisable. Si lo
  haces, añade el commit a `.git-blame-ignore-revs`.
- **23 avisos del linter en `apps/backend`**: 10 `noNonNullAssertion`, 7
  `noExplicitAny`, 6 `useImportType`. Son reales, ninguno es un fallo.
- **9 dependencias del panel fijadas a `latest`** (incluido un
  `nitro-nightly`). Cualquier `bun install` puede traer una versión distinta y
  romper el build sin que cambie una línea de código: durante esta migración,
  un nightly publicado horas antes ya cambió `NitroPluginConfig`. Conviene
  fijarlas a versiones exactas.

## Documentación por app

- `apps/backend/README.md` — referencia completa de la API (endpoints, auth, roles).
- `apps/backend/DEPLOY-BD.md` — despliegue y acceso a la base de datos.
