import type { Context, Next } from "hono";

type Options = { windowMs: number; max: number };

// Limitador de tasa en memoria (ventana deslizante por IP). Es la primera línea
// de defensa contra fuerza bruta / credential stuffing en endpoints sensibles
// como el login.
//
// NOTA: el estado es POR INSTANCIA. Con varias réplicas detrás de un balanceador
// cada una lleva su propia cuenta, por lo que el límite efectivo se multiplica
// por el nº de réplicas. Para un límite global y robusto, complementa con un
// store compartido (p. ej. Redis) o aplica el rate limiting en el WAF / reverse
// proxy que tengas delante.
export function rateLimit({ windowMs, max }: Options) {
  const hits = new Map<string, number[]>();

  return async function rateLimitMiddleware(c: Context, next: Next) {
    // Detrás de un proxy la IP real llega en X-Forwarded-For (primer salto).
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= max) {
      const retryAfter = Math.max(
        1,
        Math.ceil((timestamps[0]! + windowMs - now) / 1000),
      );
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "Demasiadas solicitudes, inténtalo más tarde",
          code: "RATE_LIMITED",
        },
        429,
      );
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

    await next();
  };
}
