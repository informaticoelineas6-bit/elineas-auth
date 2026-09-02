# Panel de administración (`@elineas/auth-admin`)

Panel del identity server: usuarios, empleados, roles, sistemas y sesiones.
TanStack Start (React + Vite, SSR con Nitro) sobre Bun.

Forma parte del monorepo `elineas-auth`. Los comandos se ejecutan **desde la
raíz**, donde están el lockfile y los scripts:

```bash
bun install
bun run dev:admin        # http://localhost:3000
```

Necesita la API levantada (`bun run dev:api`) y su propio entorno:

```bash
cp apps/admin/.env.example apps/admin/.env
```

`AUTH_API_URL` debe apuntar a la API y `AUTH_SYSTEM_SLUG` tiene que existir como
sistema en el IS, con al menos un rol asignado al usuario que inicie sesión; si
no, el login responde 403.

## Cómo habla con la API

A través de un cliente RPC **tipado** contra el grafo de rutas real del
servidor: `src/modules/common/lib/rpc.ts`. La ruta, el método, el cuerpo y la
respuesta los deriva TypeScript de `@elineas/auth-api/rpc`, así que un cambio en
la API rompe la compilación de este panel en vez de aparecer en producción.

Las reglas de validación que la API también aplica vienen de
`@elineas/auth-contracts`; no se reescriben aquí.

El módulo `users` es el patrón de referencia. Los otros siete siguen con el
cliente antiguo `src/modules/common/lib/api-client.ts` y sus tipos escritos a
mano: funcionan, y se migran uno a uno. El procedimiento está en el
[README de la raíz](../../README.md#migrar-los-módulos-que-quedan).

## Estructura

```
src/
  modules/<recurso>/
    actions/      server functions de TanStack Start
    queries/      opciones de TanStack Query
    services/     llamadas a la API (cliente RPC)
    components/   UI del recurso
    lib/          validación y utilidades
    shared/       tipos
  routes/         rutas por fichero (TanStack Router)
```

`modules/common/components/ui/` son componentes de shadcn vendorizados: se
regeneran con `shadcn add` y quedan fuera del linter.
