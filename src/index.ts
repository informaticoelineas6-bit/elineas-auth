import { createApp } from "@/app";
import { env } from "@/config/env";

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
