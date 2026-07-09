import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";
import { env } from "@/config/env";
import { authRoutes } from "@/routes/auth.routes";
import { usersRoutes } from "@/routes/users.routes";
import { sessionsRoutes } from "@/routes/sessions.routes";
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

app.route("/api/auth", authRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/sessions", sessionsRoutes);

app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Token JWT emitido por /api/auth/token o devuelto al iniciar sesión.",
});

app.doc("/api/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Elineas Auth API",
    version: "1.0.0",
    description: "API de autenticación.",
  },
  servers: [{ url: env.BETTER_AUTH_URL }],
});

app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

const server = Bun.serve({
  fetch: app.fetch,
  port: 8080,
});

console.log(`Serving on http://localhost:${server.port}`);
