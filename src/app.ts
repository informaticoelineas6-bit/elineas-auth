import { OpenAPIHono } from "@hono/zod-openapi";
import { handleError } from "@/lib/http";
import { registerSecurityMiddleware } from "@/middleware/security";
import { registerAuthRateLimits } from "@/middleware/auth-rate-limits";
import { registerRoutes } from "@/routes";
import { registerOpenApiDocs } from "@/openapi/docs";
import type { AppEnv } from "@/types/hono-env";

// openApiInfo vive junto al resto de la configuración de documentación
// (openapi/docs.ts); se reexporta aquí porque scripts/generate-openapi.ts lo
// consume junto a createApp desde este mismo módulo.
export { openApiInfo } from "@/openapi/docs";

// Construye la aplicación completamente configurada (middleware + rutas + doc)
// pero SIN abrir el puerto: así el mismo grafo de rutas alimenta tanto al
// servidor (src/index.ts) como al generador de OpenAPI, evitando que se
// desincronicen. El orden importa: middleware transversal → protecciones
// anti-abuso → manejador de errores → rutas → documentación.
export function createApp() {
  const app = new OpenAPIHono<AppEnv>();

  registerSecurityMiddleware(app);
  registerAuthRateLimits(app);
  app.onError(handleError);
  registerRoutes(app);
  registerOpenApiDocs(app);

  return app;
}
