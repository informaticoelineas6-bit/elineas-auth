import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Next } from "hono";
import { evlog } from "evlog/hono";
import { clientIp } from "@/lib/client-ip";
import type { AppEnv } from "@/types/hono-env";
// Importa por efecto secundario: ejecuta initLogger() (configura evlog + el drain
// hacia el Redis Stream) antes de montar el middleware.
import "@/lib/logging";

// Claves de query string a enmascarar además de la redacción de PII de evlog.
// better-auth pasa secretos por la URL en verificación de email / reset de
// contraseña (?token=...), así que nunca deben quedar en texto plano en la BD.
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "code",
  "state",
  "otp",
  "password",
  "secret",
  "access_token",
  "refresh_token",
  "jwt",
]);

// Tope de longitud para cadenas libres (user-agent, referer, origin). Mantiene
// los eventos magros: acota la memoria del Redis Stream y el tamaño de fila.
const MAX_STRING = 1024;

// Tope de tamaño del cuerpo a capturar. Se comprueba contra content-length ANTES
// de leer nada, de modo que nunca cargamos en memoria un cuerpo grande (el
// límite general de la API es 64 KB; aquí capturamos hasta 16 KB, más que
// suficiente para un JSON de auth). Si lo supera, se guarda solo un marcador.
const BODY_MAX_BYTES = 16 * 1024;

// Nombres de clave cuyo valor se enmascara en el cuerpo, a cualquier nivel de
// anidamiento. Cubre las variantes de contraseña (newPassword, currentPassword)
// vía "pass", además de tokens/secretos. Es una capa propia y determinista que
// se suma a la redacción de PII de evlog (email, JWT, Bearer, …).
const SENSITIVE_BODY_KEY = /pass|token|secret|otp|authorization|cookie|credential|apikey/i;

function trunc(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
}

// Enmascara recursivamente las claves sensibles de un cuerpo ya parseado.
function redactBody(value: unknown, depth = 0): unknown {
  if (depth > 6) return value; // corta anidamientos patológicos
  if (Array.isArray(value)) return value.map((item) => redactBody(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_BODY_KEY.test(key) ? "[REDACTED]" : redactBody(val, depth + 1);
    }
    return out;
  }
  return value;
}

// Captura el cuerpo de la petición de forma segura:
// - lo lee de un `clone()` para no consumir el stream que usará el handler;
// - solo métodos con cuerpo y content-types textuales (JSON, form, text);
// - exige content-length y lo acota a BODY_MAX_BYTES ANTES de leer (anti-DoS);
// - enmascara las claves sensibles.
// Devuelve `undefined` cuando no hay nada que capturar (no ensucia el evento).
async function captureBody(c: Context<AppEnv>): Promise<unknown> {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD") return undefined;

  const contentLength = Number(c.req.header("content-length") ?? "");
  // Sin content-length (p. ej. transfer chunked) no capturamos: no podemos
  // acotar cuánto leeríamos.
  if (!contentLength) return undefined;
  if (contentLength > BODY_MAX_BYTES) {
    return { _truncated: true, bytes: contentLength };
  }

  const contentType = c.req.header("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return redactBody(await c.req.raw.clone().json());
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await c.req.raw.clone().text();
      return redactBody(Object.fromEntries(new URLSearchParams(text)));
    }
    if (contentType.startsWith("text/")) {
      return trunc(await c.req.raw.clone().text());
    }
  } catch {
    // Cuerpo ilegible o JSON malformado: no bloquea el logging.
    return undefined;
  }
  // multipart / binario: no se captura.
  return undefined;
}

function redactQuery(
  query: Record<string, string>,
): Record<string, string> | undefined {
  const keys = Object.keys(query);
  if (keys.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const key of keys) {
    out[key] = SENSITIVE_QUERY_KEYS.has(key.toLowerCase())
      ? "[REDACTED]"
      : trunc(query[key])!;
  }
  return out;
}

// Middleware de enriquecimiento: corre justo por dentro de evlog. Añade al wide
// event todos los datos útiles de la petición. La captura de user/session se
// hace TRAS next() y de forma defensiva, porque solo existen en rutas que
// pasaron por requireSession (que corre aún más adentro).
async function enrich(c: Context<AppEnv>, next: Next) {
  const log = c.get("log");
  // Si evlog no montó logger (p. ej. logging deshabilitado), no hay nada que
  // enriquecer: seguimos sin tocar la petición.
  if (!log) return next();

  // requestId propio, también expuesto al cliente para poder correlacionar un
  // log con un incidente reportado. Pisa el que evlog genera por defecto.
  const requestId = crypto.randomUUID();
  c.header("X-Request-Id", requestId);
  log.set({ requestId });

  // El cuerpo se captura ANTES de next() (aún no lo consumió el handler), desde
  // un clone para no interferir con la validación de la ruta.
  const requestBody = await captureBody(c);
  if (requestBody !== undefined) log.set({ requestBody });

  // Medimos la duración del handler nosotros mismos: el `duration` de evlog es
  // una cadena formateada ("1ms", "1.2s"); aquí guardamos milisegundos numéricos.
  const start = Date.now();
  try {
    await next();
  } finally {
    const user = c.get("user");
    const session = c.get("session");
    log.set({
      durationMs: Date.now() - start,
      routePath: c.req.routePath,
      query: redactQuery(c.req.query()),
      clientIp: clientIp(c),
      userAgent: trunc(c.req.header("user-agent")),
      referer: trunc(c.req.header("referer")),
      origin: trunc(c.req.header("origin")),
      contentLength: Number(c.res.headers.get("content-length")) || undefined,
      // Solo en rutas autenticadas: en las públicas quedan sin definir.
      ...(user ? { userId: user.id } : {}),
      ...(session ? { sessionId: session.id } : {}),
    });
  }
}

// Registra el logging de peticiones sobre /api/*. Se llama en createApp() DESPUÉS
// de los health checks (para que /health no genere logs) y ANTES del resto de
// middleware transversal, de modo que el wide event envuelva timeout/cors/rate
// limit y mida la duración completa de la petición.
export function registerRequestLogging(app: OpenAPIHono<AppEnv>) {
  // 1) evlog: crea el logger, mide, emite el wide event y lo pasa al drain.
  app.use("/api/*", evlog());
  // 2) enriquecimiento con los datos de la petición.
  app.use("/api/*", enrich);
}
