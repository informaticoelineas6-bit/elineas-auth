import { createApp } from "@/app";
import { env } from "@/config/env";
import { pool } from "@/db/index";
import { redis } from "@/lib/redis";
import { startRequestLogWorker } from "@/workers/request-log-worker";

// Red de seguridad de proceso. Cualquier rechazo o excepción que escape del
// ciclo request/response (callbacks, timers, listeners de eventos) llega aquí.
//
// - unhandledRejection: se registra y se deja seguir. La mayoría son fallos
//   acotados a una operación concreta; tumbar todo el servidor por uno sería
//   peor que el propio bug.
// - uncaughtException: el proceso queda en un estado potencialmente corrupto,
//   así que se registra y se sale con código de error para que el orquestador
//   (docker `restart: unless-stopped`) lo levante limpio.
process.on("unhandledRejection", (reason) => {
  console.error(
    "Promesa rechazada sin manejar:",
    reason instanceof Error ? reason.stack ?? reason.message : reason,
  );
});

process.on("uncaughtException", (error) => {
  console.error("Excepción no capturada, cerrando el proceso:", error.stack ?? error.message);
  process.exit(1);
});

const app = createApp();

const server = Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT) || 8080,
});

// Se registra la URL pública configurada (BETTER_AUTH_URL) en vez de un
// "localhost" fijo, para que el log refleje la dirección real del entorno
// (local, staging o producción). `server.port` se mantiene como referencia
// del puerto en el que efectivamente escucha el proceso.
console.log(`Serving on ${env.BETTER_AUTH_URL} (puerto ${server.port})`);

// Worker que drena el stream de logs de peticiones (Redis) a Postgres. No-op si
// no hay REDIS_URL. Se detiene en el apagado ordenado, antes de cerrar la BD.
const requestLogWorker = startRequestLogWorker();

// Apagado ordenado. `docker stop` envía SIGTERM: sin esto, el proceso se corta
// en seco, abortando peticiones en vuelo y dejando conexiones de BD/Redis sin
// cerrar. Aquí se deja de aceptar conexiones nuevas, se drena el pool de
// Postgres y se cierra Redis antes de salir. Un segundo SIGTERM/SIGINT fuerza
// la salida inmediata por si el drenado se atasca.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) {
    console.warn(`${signal} recibido durante el apagado; salida forzada.`);
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`${signal} recibido, cerrando ordenadamente…`);
  try {
    await server.stop();
    // Flush final del stream de logs a Postgres ANTES de cerrar el pool y Redis
    // (los necesita para drenar). Si no termina, no se pierde nada: el stream es
    // persistente y se drena al reiniciar.
    await requestLogWorker.stop();
    await pool.end();
    if (redis) redis.close();
    console.log("Apagado completado.");
    process.exit(0);
  } catch (error) {
    console.error(
      "Error durante el apagado:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
