import type { Context, Next } from "hono";
import { redis } from "@/lib/redis";

type Options = {
  // Prefijo del contador; distingue límites (p. ej. "sign-in" vs "sign-up").
  name: string;
  windowMs: number;
  max: number;
};

// Detrás de un proxy la IP real llega en X-Forwarded-For (primer salto).
function clientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
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
// INCR crea la clave a 1 y la incrementa atómicamente; en la primera petición
// de la ventana se le fija un TTL. Así todas las instancias comparten la misma
// cuenta. Si Redis falla, se hace "fail open" (dejar pasar) para que una caída
// de Redis no bloquee el login.
async function redisAllowed(
  key: string,
  windowMs: number,
  max: number,
): Promise<{ limited: boolean; retryAfter: number }> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const count = Number(await redis!.send("INCR", [key]));
  if (count === 1) {
    await redis!.send("EXPIRE", [key, String(windowSeconds)]);
  }
  if (count > max) {
    const ttl = Number(await redis!.send("TTL", [key]));
    return { limited: true, retryAfter: ttl > 0 ? ttl : windowSeconds };
  }
  return { limited: false, retryAfter: 0 };
}

// --- Backend en memoria (fallback por instancia, ventana deslizante) ---
//
// Solo se usa si no hay REDIS_URL. El estado es POR INSTANCIA: con varias
// réplicas el límite efectivo se multiplica por el nº de réplicas.
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
// entre réplicas); si no, cae a un contador en memoria por instancia.
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
        // Fail open: no bloqueamos si Redis no responde, solo lo registramos.
        console.error(
          "Rate limit (Redis) no disponible, se permite la petición:",
          error instanceof Error ? error.message : error,
        );
        return next();
      }
    }

    const { limited, retryAfter } = memoryCheck(ip);
    if (limited) return tooMany(c, retryAfter);
    return next();
  };
}
