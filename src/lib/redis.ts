import { RedisClient } from "bun";
import { env } from "@/config/env";

// Cliente Redis compartido de toda la app. Bun trae un cliente nativo, por lo
// que no hace falta ninguna dependencia externa.
//
// Es `null` cuando no se ha configurado REDIS_URL: en ese caso el rate limiter
// degrada a un contador en memoria por instancia (ver middleware/rate-limit).
// La conexión es perezosa: se establece con el primer comando.
export const redis = env.REDIS_URL ? new RedisClient(env.REDIS_URL) : null;

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
