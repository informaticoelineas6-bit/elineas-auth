import { OpenAPIHono } from "@hono/zod-openapi";
import { handleError } from "@api/lib/http.ts";
import { registerRequestLogging } from "@api/middleware/request-log.ts";
import { registerSecurityMiddleware } from "@api/middleware/security.ts";
import { registerAuthRateLimits } from "@api/middleware/auth-rate-limits.ts";
import { registerHealthChecks } from "@api/routes/health.routes.ts";
import { registerRoutes } from "@api/routes/index.ts";
import { registerOpenApiDocs } from "@api/openapi/docs.ts";
import type { AppEnv } from "@api/types/hono-env.ts";

// openApiInfo vive junto al resto de la configuración de documentación
// (openapi/docs.ts); se reexporta aquí porque scripts/generate-openapi.ts lo
// consume junto a createApp desde este mismo módulo.
export { openApiInfo } from "@api/openapi/docs.ts";

// Construye la aplicación completamente configurada (middleware + rutas + doc)
// pero SIN abrir el puerto: así el mismo grafo de rutas alimenta tanto al
// servidor (src/index.ts) como al generador de OpenAPI, evitando que se
// desincronicen. El orden importa: middleware transversal → protecciones
// anti-abuso → manejador de errores → rutas → documentación.
export function createApp() {
  const app = new OpenAPIHono<AppEnv>();

  // Health checks primero: así no heredan logger (ruido en cada sondeo), CORS,
  // rate limiting ni el timeout, y no dependen de nada externo.
  registerHealthChecks(app);
  // Request logging (evlog) justo después de health: envuelve al resto de la
  // cadena (timeout, CORS, rate limit, rutas) para medir la duración completa y
  // registrar también las respuestas de error de esos middlewares.
  registerRequestLogging(app);
  registerSecurityMiddleware(app);
  registerAuthRateLimits(app);
  app.onError(handleError);
  // registerRoutes devuelve el app con las rutas ENCADENADAS: capturamos ese
  // valor (no el `app` original) porque es el que lleva los tipos por endpoint.
  const routedApp = registerRoutes(app);
  registerOpenApiDocs(routedApp);

  return routedApp;
}

// Contrato del servidor para el cliente RPC. `AppType` captura la firma completa
// del grafo de rutas (métodos, paths, entradas y salidas); los clientes lo
// consumen vía `hc<AppType>` para obtener type safety sin acoplarse al código
// del servidor. Se reexporta desde `@/rpc` (el entry público del paquete).
export type AppType = ReturnType<typeof createApp>;
