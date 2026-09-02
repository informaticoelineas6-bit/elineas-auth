import type { OpenAPIHono } from "@hono/zod-openapi";
import { authRoutes } from "@backend/routes/auth.routes.ts";
import { usersAdminRoutes, usersRoutes } from "@backend/routes/users.routes.ts";
import { sessionsAdminRoutes, sessionsRoutes } from "@backend/routes/sessions.routes.ts";
import { employeesRoutes } from "@backend/routes/employees.routes.ts";
import { systemsRoutes } from "@backend/routes/systems.routes.ts";
import { rolesRoutes } from "@backend/routes/roles.routes.ts";
import { userRolesRoutes } from "@backend/routes/user-roles.routes.ts";
import { requestLogsRoutes } from "@backend/routes/request-logs.routes.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";

// Tabla de montaje de la API: cada familia de endpoints bajo su prefijo. Es el
// único sitio que hay que tocar para añadir o quitar un grupo de rutas, de modo
// que el mapa completo de la API se lee de un vistazo.
// Devuelve el app con las rutas montadas ENCADENADAS: así el tipo resultante
// acumula la firma de cada endpoint (método, path, entrada y salida), que es lo
// que el cliente RPC de Hono (`hc<AppType>`) necesita para dar type safety
// extremo a extremo. Si se rompe el encadenado (montar con sentencias sueltas),
// el RPC compila pero pierde los tipos por endpoint.
export function registerRoutes(app: OpenAPIHono<AppEnv>) {
  return app
    .route("/api/auth", authRoutes)
    .route("/api/users", usersRoutes)
    .route("/api/users/admin", usersAdminRoutes)
    .route("/api/sessions", sessionsRoutes)
    .route("/api/sessions/admin", sessionsAdminRoutes)
    .route("/api/employees", employeesRoutes)
    .route("/api/systems", systemsRoutes)
    .route("/api/roles", rolesRoutes)
    .route("/api/user-roles", userRolesRoutes)
    .route("/api/request-logs", requestLogsRoutes);
}
