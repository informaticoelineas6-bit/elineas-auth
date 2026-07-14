import type { OpenAPIHono } from "@hono/zod-openapi";
import { authRoutes } from "@/routes/auth.routes";
import { usersRoutes } from "@/routes/users.routes";
import { sessionsRoutes } from "@/routes/sessions.routes";
import { employeesRoutes } from "@/routes/employees.routes";
import { systemsRoutes } from "@/routes/systems.routes";
import { rolesRoutes } from "@/routes/roles.routes";
import { userRolesRoutes } from "@/routes/user-roles.routes";
import type { AppEnv } from "@/types/hono-env";

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
    .route("/api/employees", employeesRoutes)
    .route("/api/systems", systemsRoutes)
    .route("/api/roles", rolesRoutes)
    .route("/api/user-roles", userRolesRoutes);
}
