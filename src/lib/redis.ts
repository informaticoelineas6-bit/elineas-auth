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

// Ejecuta un comando de Redis con un límite de tiempo. Un Redis "vivo pero
// lento" (red congestionada, failover en curso) podría dejar un `send()`
// colgado indefinidamente y frenar cada petición; con este tope, si no responde
// a tiempo la promesa rechaza y quien llama degrada a su plan B (memoria/BD).
export async function redisCommand<T>(
  fn: () => Promise<T>,
  timeoutMs = 250,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Redis command timeout (${timeoutMs}ms)`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
