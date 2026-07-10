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
import { rateLimit } from "@/middleware/rate-limit";
import { logger } from "hono/logger";
import type { AppEnv } from "@/types/hono-env";

const app = new OpenAPIHono<AppEnv>();

app.use(
  "/api/*",
  cors({
    // Refleja el origen de la petición solo si está en la lista permitida; en
    // caso contrario no se emite la cabecera y el navegador bloquea la petición.
    // (Las peticiones servidor-a-servidor no envían Origin y no se ven afectadas.)
    origin: (origin) =>
      env.ALLOWED_ORIGINS.includes(origin) ? origin : null,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Auth-Token", "Set-Auth-Jwt"],
    maxAge: 600,
    credentials: true,
  }),
);
app.use(logger());

// Rate limiting en los endpoints sensibles (contra fuerza bruta / credential
// stuffing). Se registra antes que las rutas para que se ejecute primero.
app.use("/api/auth/sign-in", rateLimit({ windowMs: 60_000, max: 10 }));
app.use("/api/auth/sign-up", rateLimit({ windowMs: 60_000, max: 5 }));

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

// La documentación (OpenAPI + Swagger UI) expone el mapa completo de la API,
// por lo que solo se publica fuera de producción. En prod queda deshabilitada
// para no dar información de reconocimiento a un atacante.
if (env.APP_ENV !== "production") {
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
    servers: [
      { url: new URL(c.req.url).origin, description: "Servidor actual" },
    ],
  }));

  app.get(
    "/api/docs",
    swaggerUI({ url: "/api/openapi.json", version: "5.18.2" }),
  );
}

const server = Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 8080,
});

console.log(`Serving on http://localhost:${server.port}`);
