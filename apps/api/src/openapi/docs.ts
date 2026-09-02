import type { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { env } from "@/config/env";
import type { AppEnv } from "@/types/hono-env";

// Metadatos del documento OpenAPI. Se reutilizan tanto en el endpoint en vivo
// (`/api/openapi.json`) como en el generador estático (scripts/generate-openapi.ts),
// para que el fichero del repo y la API sirvan exactamente el mismo esquema.
export const openApiInfo = {
  title: "Elineas Auth API",
  version: "1.0.0",
  description: "API de autenticación.",
} as const;

// Registra el esquema de seguridad y, fuera de producción, publica el documento
// OpenAPI y Swagger UI.
export function registerOpenApiDocs(app: OpenAPIHono<AppEnv>) {
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
}
