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
export function registerRoutes(app: OpenAPIHono<AppEnv>) {
  app.route("/api/auth", authRoutes);
  app.route("/api/users", usersRoutes);
  app.route("/api/sessions", sessionsRoutes);
  app.route("/api/employees", employeesRoutes);
  app.route("/api/systems", systemsRoutes);
  app.route("/api/roles", rolesRoutes);
  app.route("/api/user-roles", userRolesRoutes);
}
