import type { OpenAPIHono } from "@hono/zod-openapi";
import { authRoutes } from "@api/routes/auth.routes.ts";
import { usersRoutes } from "@api/routes/users.routes.ts";
import { sessionsAdminRoutes, sessionsRoutes } from "@api/routes/sessions.routes.ts";
import { employeesRoutes } from "@api/routes/employees.routes.ts";
import { systemsRoutes } from "@api/routes/systems.routes.ts";
import { rolesRoutes } from "@api/routes/roles.routes.ts";
import { userRolesRoutes } from "@api/routes/user-roles.routes.ts";
import { requestLogsRoutes } from "@api/routes/request-logs.routes.ts";
import type { AppEnv } from "@api/types/hono-env.ts";

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
    .route("/api/sessions", sessionsRoutes)
    .route("/api/sessions/admin", sessionsAdminRoutes)
    .route("/api/employees", employeesRoutes)
    .route("/api/systems", systemsRoutes)
    .route("/api/roles", rolesRoutes)
    .route("/api/user-roles", userRolesRoutes)
    .route("/api/request-logs", requestLogsRoutes);
}
