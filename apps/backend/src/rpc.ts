// Entry público del contrato RPC del paquete `@elineas/auth-backend` (ver el campo
// "exports" en package.json: `@elineas/auth-backend/rpc`).
//
// Expone ÚNICAMENTE tipos del grafo de rutas, no código ejecutable, para que
// los consumidores (el panel admin, cualquier otro frontend) obtengan type
// safety extremo a extremo sin arrastrar el runtime del servidor (BD, Redis,
// auth) a su bundle.

export type { AppType } from "./app.ts";

// Tipos por grupo de rutas, además de `AppType`.
//
// Hacen falta porque el cliente RPC de Hono (`hc<AppType>`) pierde los
// sub-paths de un nodo que es a la vez HOJA y RAMA. `/api/users/me` es
// exactamente ese caso: tiene GET y PATCH propios y además dos hijos
// (`/me/change-password`, `/me/change-email`). Al fusionar las rutas montadas,
// `hc<AppType>` deja ese nodo como una `ClientRequest` con `$get`/`$patch` y
// descarta los hijos, así que `rpc.api.users.me["change-password"]` no compila.
// Sobre el tipo del sub-app sin montar, en cambio, se conserva todo.
//
// Los prefijos con los que se montan viven en `routes/index.ts`; el panel los
// declara una sola vez al construir cada cliente (ver
// `apps/frontend/src/modules/common/lib/rpc.ts`).
export type AuthRoutes = typeof import("./routes/auth.routes.ts").authRoutes;
export type UsersRoutes = typeof import("./routes/users.routes.ts").usersRoutes;
export type UsersAdminRoutes =
  typeof import("./routes/users.routes.ts").usersAdminRoutes;
export type SessionsRoutes =
  typeof import("./routes/sessions.routes.ts").sessionsRoutes;
export type SessionsAdminRoutes =
  typeof import("./routes/sessions.routes.ts").sessionsAdminRoutes;
export type EmployeesRoutes =
  typeof import("./routes/employees.routes.ts").employeesRoutes;
export type SystemsRoutes =
  typeof import("./routes/systems.routes.ts").systemsRoutes;
export type RolesRoutes = typeof import("./routes/roles.routes.ts").rolesRoutes;
export type UserRolesRoutes =
  typeof import("./routes/user-roles.routes.ts").userRolesRoutes;
export type RequestLogsRoutes =
  typeof import("./routes/request-logs.routes.ts").requestLogsRoutes;
