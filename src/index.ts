import { createApp } from "@/app";
import { env } from "@/config/env";

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
