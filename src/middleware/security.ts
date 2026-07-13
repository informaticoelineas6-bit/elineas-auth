import type { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { HTTPException } from "hono/http-exception";
import { env } from "@/config/env";
import type { AppEnv } from "@/types/hono-env";

// Tope de tiempo por petición. Si un handler se cuelga (BD bloqueada, better-auth
// sin responder, etc.), el cliente recibe un 504 en vez de esperar para siempre
// y retener recursos. Es holgado respecto a los timeouts de query del pool
// (10-12s) para que el error específico de la query gane la carrera cuando el
// problema sea de BD, dejando este como red de seguridad de último recurso.
const REQUEST_TIMEOUT_MS = 15_000;

// Middleware transversal de seguridad y observabilidad (CORS, cabeceras de
// seguridad, logging y límite de tamaño del cuerpo). Se agrupa aquí para que
// createApp() sea una composición legible y para poder razonar sobre toda la
// postura de seguridad HTTP en un solo lugar.
export function registerSecurityMiddleware(app: OpenAPIHono<AppEnv>) {
  // Se registra el primero para que envuelva a todo el resto de la cadena
  // (validación, rutas, BD). Lanza una HTTPException 504 que handleError traduce
  // a JSON consistente con el resto de la API.
  app.use(
    "/api/*",
    timeout(
      REQUEST_TIMEOUT_MS,
      () =>
        new HTTPException(504, {
          message: "La solicitud tardó demasiado en procesarse",
        }),
    ),
  );

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

  // Cabeceras de seguridad (nosniff, HSTS, X-Frame-Options: DENY, etc.). El CSP
  // permite el CDN de Swagger UI (cdn.jsdelivr.net) e inline solo porque la
  // página de documentación —único HTML que sirve esta API— lo requiere; en
  // producción la doc está deshabilitada y el resto de respuestas son JSON, para
  // las que el CSP es inocuo.
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        imgSrc: ["'self'", "https://cdn.jsdelivr.net", "data:"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
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
}
