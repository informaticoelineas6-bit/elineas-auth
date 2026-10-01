import type { Context, Next } from "hono";
import { redis, redisCommand } from "@backend/lib/redis.ts";
import { clientIp } from "@backend/lib/client-ip.ts";

type Options = {
  // Prefijo del contador; distingue límites (p. ej. "sign-in" vs "sign-up").
  name: string;
  windowMs: number;
  max: number;
  // Identificador opcional del sujeto a limitar. Por defecto se usa la IP del
  // cliente; con esto se puede limitar por otra dimensión (p. ej. el email de
  // destino, para frenar la fuerza bruta distribuida contra UNA sola cuenta).
  // Si devuelve undefined (no se pudo derivar la clave), NO se limita: la
  // protección por IP —registrada aparte— sigue aplicando.
  key?: (c: Context) => string | undefined | Promise<string | undefined>;
};

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

// SHA1 del script para invocarlo con EVALSHA: evita reenviar el script completo
// en cada petición de esta ruta caliente (Redis lo cachea por su hash). Si Redis
// aún no lo conoce (arranque, SCRIPT FLUSH, failover), responde NOSCRIPT y se
// reenvía una única vez con EVAL, que además lo deja cacheado para las
// siguientes.
const RATE_LIMIT_LUA_SHA = new Bun.CryptoHasher("sha1")
  .update(RATE_LIMIT_LUA)
  .digest("hex");

type LuaReply = [number | string, number | string];

async function redisAllowed(
  key: string,
  windowMs: number,
  max: number,
): Promise<{ limited: boolean; retryAfter: number }> {
  const args = ["1", key, String(windowMs)];
  let result: LuaReply;
  try {
    result = (await redisCommand(() =>
      redis!.send("EVALSHA", [RATE_LIMIT_LUA_SHA, ...args]),
    )) as LuaReply;
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("NOSCRIPT"))) {
      throw error;
    }
    result = (await redisCommand(() =>
      redis!.send("EVAL", [RATE_LIMIT_LUA, ...args]),
    )) as LuaReply;
  }

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
  let lastSweep = 0;

  return function check(id: string): { limited: boolean; retryAfter: number } {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (hits.get(id) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= max) {
      const retryAfter = Math.ceil((timestamps[0]! + windowMs - now) / 1000);
      return { limited: true, retryAfter };
    }

    timestamps.push(now);
    hits.set(id, timestamps);

    // Limpieza oportunista para evitar que el Map crezca sin límite. Se acota a
    // como mucho una barrida por ventana: si hay >10k claves ACTIVAS, sin este
    // tope se recorrería el Map entero en CADA petición (O(n) por request).
    if (hits.size > 10_000 && now - lastSweep > windowMs) {
      lastSweep = now;
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
export function rateLimit({ name, windowMs, max, key }: Options) {
  const memoryCheck = inMemoryLimiter(windowMs, max);

  return async function rateLimitMiddleware(c: Context, next: Next) {
    // El sujeto a limitar: la clave personalizada (p. ej. el email) si se
    // definió, o la IP del cliente en caso contrario. Si el generador de clave
    // no pudo derivar un valor, se omite este limitador (la protección por IP
    // se registra como un middleware aparte).
    const id = key ? await key(c) : clientIp(c);
    if (id === undefined) return next();

    if (redis) {
      try {
        const { limited, retryAfter } = await redisAllowed(
          `ratelimit:${name}:${id}`,
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

    const { limited, retryAfter } = memoryCheck(id);
    if (limited) return tooMany(c, retryAfter);
    return next();
  };
}

// Limitador que cuenta SOLO los intentos fallidos (respuesta 401). A diferencia
// de `rateLimit`, que suma cada petición, el contador no sube con logins
// correctos, y se comprueba ANTES del handler pero se incrementa DESPUÉS, una
// vez conocido el resultado.
//
// Se usa para el bloqueo por cuenta del login. Con `rateLimit` sobre el email,
// 10 intentos (aunque fueran de un atacante) bloqueaban a la víctima 15 min. Aquí
// la clave suele combinar email + IP, de modo que quien falla repetidamente solo
// se bloquea a sí mismo; un umbral aparte, mucho más alto y solo por email, frena
// la fuerza bruta distribuida sin que un atacante pueda bloquear cuentas ajenas
// con unos pocos intentos.
//
// La comprobación y el incremento no son atómicos entre sí: peticiones
// simultáneas pueden pasar un puñado de intentos del umbral. Es aceptable aquí
// (el umbral es una barrera de abuso, no un contador de precisión).
export function failureRateLimit({ name, windowMs, max, key }: Options) {
  const failures = new Map<string, number[]>();

  const recentInMemory = (id: string): number[] => {
    const windowStart = Date.now() - windowMs;
    const fresh = (failures.get(id) ?? []).filter((t) => t > windowStart);
    if (fresh.length === 0) failures.delete(id);
    else failures.set(id, fresh);
    return fresh;
  };

  return async function failureRateLimitMiddleware(c: Context, next: Next) {
    const id = key ? await key(c) : clientIp(c);
    if (id === undefined) return next();
    const redisKey = `ratelimit:${name}:${id}`;

    let useMemory = !redis;
    if (redis) {
      try {
        const count = Number(
          (await redisCommand(() => redis!.send("GET", [redisKey]))) ?? 0,
        );
        if (count >= max) {
          const ttlMs = Number(
            await redisCommand(() => redis!.send("PTTL", [redisKey])),
          );
          return tooMany(
            c,
            ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000),
          );
        }
      } catch {
        useMemory = true;
      }
    }
    if (useMemory) {
      const recent = recentInMemory(id);
      if (recent.length >= max) {
        return tooMany(c, Math.ceil((recent[0]! + windowMs - Date.now()) / 1000));
      }
    }

    await next();

    // 401 = credenciales incorrectas. Cualquier otro resultado (éxito, 403 por
    // falta de roles tras una contraseña válida, 429, errores) no cuenta.
    if (c.res.status !== 401) return;

    if (!useMemory && redis) {
      try {
        await redisAllowed(redisKey, windowMs, max);
        return;
      } catch {
        // Redis falló al registrar: se anota en memoria.
      }
    }
    failures.set(id, [...recentInMemory(id), Date.now()]);
  };
}
