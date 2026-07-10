import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
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

// Metadatos del documento OpenAPI. Se reutilizan tanto en el endpoint en vivo
// (`/api/openapi.json`) como en el generador estático (scripts/generate-openapi.ts),
// para que el fichero del repo y la API sirvan exactamente el mismo esquema.
export const openApiInfo = {
  title: "Elineas Auth API",
  version: "1.0.0",
  description: "API de autenticación.",
} as const;

// Construye la aplicación completamente configurada (middleware + rutas + doc)
// pero SIN abrir el puerto: así el mismo grafo de rutas alimenta tanto al
// servidor (src/index.ts) como al generador de OpenAPI, evitando que se
// desincronicen.
export function createApp() {
  const app = new OpenAPIHono<AppEnv>();

  app.use(
    "/api/*",
    cors({
      // Refleja el origen de la petición solo si está en la lista permitida; en
      // caso contrario no se emite la cabecera y el navegador bloquea la petición.
      // (Las peticiones servidor-a-servidor no envían Origin y no se ven afectadas.)
      origin: (origin) => (env.ALLOWED_ORIGINS.includes(origin) ? origin : null),
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length", "Set-Auth-Token", "Set-Auth-Jwt"],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.use(logger());

  // Límite de tamaño del cuerpo: los endpoints solo reciben JSON pequeño
  // (credenciales, actualizaciones de perfil). 64 KB es holgado y evita que un
  // atacante agote memoria enviando cuerpos enormes a rutas públicas.
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (c) =>
        c.json(
          { error: "Cuerpo de la petición demasiado grande", code: "PAYLOAD_TOO_LARGE" },
          413,
        ),
    }),
  );

  // Rate limiting en los endpoints sensibles (contra fuerza bruta / credential
  // stuffing). Se registra antes que las rutas para que se ejecute primero.
  app.use(
    "/api/auth/sign-in",
    rateLimit({ name: "sign-in", windowMs: 60_000, max: 10 }),
  );
  app.use(
    "/api/auth/sign-up",
    rateLimit({ name: "sign-up", windowMs: 60_000, max: 5 }),
  );
  // Cambio de contraseña/email: aunque exigen sesión, deben limitarse para que una
  // sesión robada no permita fuerza bruta de la contraseña actual saltándose el
  // límite del login.
  app.use(
    "/api/users/me/change-password",
    rateLimit({ name: "change-password", windowMs: 60_000, max: 5 }),
  );
  app.use(
    "/api/users/me/change-email",
    rateLimit({ name: "change-email", windowMs: 60_000, max: 5 }),
  );

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
      info: openApiInfo,
      servers: [{ url: new URL(c.req.url).origin, description: "Servidor actual" }],
    }));

    app.get(
      "/api/docs",
      swaggerUI({ url: "/api/openapi.json", version: "5.18.2" }),
    );
  }

  return app;
}
