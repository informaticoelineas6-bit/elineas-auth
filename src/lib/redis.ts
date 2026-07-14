import { RedisClient } from "bun";
import { env } from "@/config/env";

// Cliente Redis compartido de toda la app. Bun trae un cliente nativo, por lo
// que no hace falta ninguna dependencia externa.
//
// Es `null` cuando no se ha configurado REDIS_URL: en ese caso el rate limiter
// degrada a un contador en memoria por instancia (ver middleware/rate-limit).
// La conexión es perezosa: se establece con el primer comando.
export const redis = env.REDIS_URL
  ? new RedisClient(env.REDIS_URL, {
      // Acota cuánto puede tardar en establecerse la conexión. Sin esto (10s por
      // defecto) un Redis inalcanzable podría colgar la primera petición varios
      // segundos antes de degradar al contador en memoria.
      connectionTimeout: 500,
    })
  : null;

if (redis) {
  // Un fallo de Redis no debe tumbar la API: el rate limiter lo trata como
  // "fail open" (deja pasar la petición). Solo lo registramos.
  redis.onclose = (error) => {
    console.error(
      "Conexión con Redis cerrada:",
      error instanceof Error ? error.message : error,
    );
  };
}

// --- Circuit breaker ---
//
// Un Redis caído o "vivo pero lento" haría que CADA petición a rutas con rate
// limit o requireAdmin pagara el timeout completo antes de degradar. El breaker
// corta esa penalización: tras varios fallos seguidos "abre" y, durante un
// cooldown, `redisCommand` rechaza al instante (sin intentar la conexión), de
// modo que quien llama cae a su plan B (memoria/BD) sin latencia. Pasado el
// cooldown deja pasar UNA petición de prueba (half-open): si va bien, cierra; si
// falla, reabre otro cooldown.
const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 30_000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

// Ejecuta un comando de Redis con un límite de tiempo y protegido por el
// breaker. Un Redis "vivo pero lento" (red congestionada, failover en curso)
// podría dejar un `send()` colgado indefinidamente y frenar cada petición; con
// el tope, si no responde a tiempo la promesa rechaza y quien llama degrada a su
// plan B (memoria/BD).
export async function redisCommand<T>(
  fn: () => Promise<T>,
  timeoutMs = 250,
): Promise<T> {
  // Breaker abierto: rechazamos sin tocar Redis para no pagar el timeout.
  if (breakerOpenUntil > Date.now()) {
    throw new Error("Redis circuit breaker abierto");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Redis command timeout (${timeoutMs}ms)`)),
          timeoutMs,
        );
      }),
    ]);
    // Éxito (incluye la petición de prueba en half-open): cerramos el breaker.
    consecutiveFailures = 0;
    breakerOpenUntil = 0;
    return result;
  } catch (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
      breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
      console.error(
        `Redis: ${consecutiveFailures} fallos seguidos; breaker abierto ${BREAKER_COOLDOWN_MS}ms.`,
      );
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
