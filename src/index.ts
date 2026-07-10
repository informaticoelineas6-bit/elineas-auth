import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";
import { env } from "@/config/env";
import { authRoutes } from "@/routes/auth.routes";
import { usersRoutes } from "@/routes/users.routes";
import { sessionsRoutes } from "@/routes/sessions.routes";
import { employeesRoutes } from "@/routes/employees.routes";
import { systemsRoutes } from "@/routes/systems.routes";
import { rolesRoutes } from "@/routes/roles.routes";
import { userRolesRoutes } from "@/routes/user-roles.routes";
import { handleError } from "@/lib/http";
import { logger } from "hono/logger";
import type { AppEnv } from "@/types/hono-env";

const app = new OpenAPIHono<AppEnv>();

app.use(
  "/api/*",
  cors({
    origin: env.ALLOWED_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Auth-Token", "Set-Auth-Jwt"],
    maxAge: 600,
    credentials: true,
  }),
);
app.use(logger());

app.onError(handleError);

app.route("/api/auth", authRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/sessions", sessionsRoutes);
app.route("/api/employees", employeesRoutes);
app.route("/api/systems", systemsRoutes);
app.route("/api/roles", rolesRoutes);
app.route("/api/user-roles", userRolesRoutes);

app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Token JWT emitido por /api/auth/token o devuelto al iniciar sesión.",
});

// El servidor se deriva del origen de la petición que sirve la documentación,
// de modo que "Try it out" en Swagger UI apunte siempre a esta misma API
// (local, staging o producción) sin depender de BETTER_AUTH_URL.
app.doc("/api/openapi.json", (c) => ({
  openapi: "3.0.0",
  info: {
    title: "Elineas Auth API",
    version: "1.0.0",
    description: "API de autenticación.",
  },
  servers: [{ url: new URL(c.req.url).origin, description: "Servidor actual" }],
}));

app.get(
  "/api/docs",
  swaggerUI({ url: "/api/openapi.json", version: "5.18.2" }),
);

const server = Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 8080,
});

console.log(`Serving on http://localhost:${server.port}`);
