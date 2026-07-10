import type { Context, Next } from "hono";
import { getConnInfo } from "hono/bun";
import { redis } from "@/lib/redis";
import { env } from "@/config/env";

type Options = {
  // Prefijo del contador; distingue límites (p. ej. "sign-in" vs "sign-up").
  name: string;
  windowMs: number;
  max: number;
};

// IP del cliente para el rate limiting. Por defecto usa la IP real del socket
// (getConnInfo), que NO es falsificable por el cliente. La cabecera
// X-Forwarded-For solo se tiene en cuenta si TRUST_PROXY_HOPS > 0, es decir,
// cuando la API está detrás de un nº conocido de proxies de confianza.
//
// Confiar ciegamente en XFF permitiría a un atacante rotar la cabecera en cada
// petición y obtener un contador nuevo cada vez, anulando el límite. Por eso se
// lee de DERECHA a IZQUIERDA: cada proxy AÑADE al final, así que el valor que
// puso nuestro proxy de confianza más externo (a `hops` posiciones del final)
// es el único que el cliente no puede forjar.
function clientIp(c: Context): string {
  const socketIp = getConnInfo(c).remote.address ?? "unknown";

  const hops = env.TRUST_PROXY_HOPS;
  if (hops <= 0) return socketIp;

  const forwarded = c.req.header("x-forwarded-for");
  if (!forwarded) return socketIp;

  const parts = forwarded
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // El valor fiable es el que añadió el proxy de confianza más externo: a
  // `hops` posiciones contando desde el final. Todo lo que haya a su izquierda
  // lo pudo inyectar el cliente y se ignora.
  const index = parts.length - hops;
  return parts[index] ?? socketIp;
}

function tooMany(c: Context, retryAfterSeconds: number) {
  c.header("Retry-After", String(Math.max(1, retryAfterSeconds)));
  return c.json(
    {
      error: "Demasiadas solicitudes, inténtalo más tarde",
      code: "RATE_LIMITED",
    },
    429,
  );
}

// --- Backend Redis (ventana fija, contador atómico compartido entre réplicas) ---
//
// INCR + PEXPIRE + PTTL se ejecutan dentro de un único script Lua para que sean
// atómicos: si el proceso muriera entre el INCR (que crea la clave a 1) y el
// EXPIRE, la clave quedaría sin TTL y ese IP bloqueado permanentemente. En un
// EVAL, Redis aplica las tres operaciones como una sola unidad.
const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

async function redisAllowed(
  key: string,
  windowMs: number,
  max: number,
): Promise<{ limited: boolean; retryAfter: number }> {
  const result = (await redis!.send("EVAL", [
    RATE_LIMIT_LUA,
    "1",
    key,
    String(windowMs),
  ])) as [number | string, number | string];

  const count = Number(result[0]);
  if (count > max) {
    const ttlMs = Number(result[1]);
    const retryAfter =
      ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);
    return { limited: true, retryAfter };
  }
  return { limited: false, retryAfter: 0 };
}

// --- Backend en memoria (fallback por instancia, ventana deslizante) ---
//
// Se usa si no hay REDIS_URL y también como degradación si Redis falla. El
// estado es POR INSTANCIA: con varias réplicas el límite efectivo se multiplica
// por el nº de réplicas, pero sigue habiendo protección (a diferencia de dejar
// pasar todo).
function inMemoryLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();

  return function check(ip: string): { limited: boolean; retryAfter: number } {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= max) {
      const retryAfter = Math.ceil((timestamps[0]! + windowMs - now) / 1000);
      return { limited: true, retryAfter };
    }

    timestamps.push(now);
    hits.set(ip, timestamps);

    // Limpieza oportunista para evitar que el Map crezca sin límite.
    if (hits.size > 10_000) {
      for (const [key, ts] of hits) {
        const fresh = ts.filter((t) => t > windowStart);
        if (fresh.length === 0) hits.delete(key);
        else hits.set(key, fresh);
      }
    }

    return { limited: false, retryAfter: 0 };
  };
}

// Limitador de tasa. Usa Redis si está configurado (límite global compartido
// entre réplicas); si no —o si Redis falla— cae a un contador en memoria por
// instancia. Nunca "fail open": ante un fallo de Redis degradamos, no
// desprotegemos.
export function rateLimit({ name, windowMs, max }: Options) {
  const memoryCheck = inMemoryLimiter(windowMs, max);

  return async function rateLimitMiddleware(c: Context, next: Next) {
    const ip = clientIp(c);

    if (redis) {
      try {
        const { limited, retryAfter } = await redisAllowed(
          `ratelimit:${name}:${ip}`,
          windowMs,
          max,
        );
        if (limited) return tooMany(c, retryAfter);
        return next();
      } catch (error) {
        // Fail closed a memoria: si Redis no responde degradamos al contador
        // por instancia en lugar de dejar pasar todas las peticiones.
        console.error(
          "Rate limit (Redis) no disponible, se degrada a memoria:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    const { limited, retryAfter } = memoryCheck(ip);
    if (limited) return tooMany(c, retryAfter);
    return next();
  };
}
