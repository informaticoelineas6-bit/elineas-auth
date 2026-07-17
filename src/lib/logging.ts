import { initLogger, type DrainContext } from "evlog";
import { redis, redisCommand } from "@/lib/redis";
import { env } from "@/config/env";

// Clave del Redis Stream donde se encolan los wide events de cada request.
// Compartida entre el productor (este drain) y el consumidor (el worker de
// drenado, workers/request-log-worker.ts).
export const STREAM_KEY = "request_logs";

// Tope aproximado de entradas del stream. Acota la memoria de Redis: si el
// worker se detiene, Redis descarta las entradas más antiguas en vez de crecer
// sin control. `MAXLEN ~` (trimming aproximado) mantiene el XADD barato. Es un
// buffer, no el almacén final (ese es Postgres); perder logs viejos del buffer
// es preferible a arriesgar la estabilidad de Redis.
export const STREAM_MAXLEN = 100_000;

// Drain de evlog: se invoca con cada wide event ya emitido. Encola el evento en
// el Redis Stream de forma fire-and-forget.
//
// IMPORTANTE: en Hono el drain se ejecuta DENTRO del ciclo de la petición (evlog
// hace `await finish()` tras el handler). Por eso NO se hace await del XADD: se
// dispara y se olvida, de modo que la latencia de Redis nunca se suma a la
// respuesta. Un fallo de Redis tampoco afecta: el evento ya salió por consola y
// el `.catch` lo absorbe (fail-open, mismo patrón que el rate limiter).
function requestLogDrain(ctx: DrainContext): void {
  if (!redis) return;

  const event = ctx.event;
  // Solo nos interesan los eventos de request (tienen `method` y `status`).
  // Otros logs sueltos (log.info/errores fuera de una petición) se ignoran para
  // no ensuciar la tabla request_log.
  if (typeof event.method !== "string" || event.status === undefined) return;

  const payload = JSON.stringify(event);

  // redisCommand aporta timeout + circuit breaker; no se await a propósito.
  void redisCommand(() =>
    redis!.send("XADD", [
      STREAM_KEY,
      "MAXLEN",
      "~",
      String(STREAM_MAXLEN),
      "*",
      "event",
      payload,
    ]),
  ).catch(() => {
    // Fail-open: si Redis no está disponible, el log de consola ya cubrió la
    // observabilidad. No hay nada más que hacer aquí.
  });
}

// Configura el logger global de evlog. Se ejecuta una vez al importar el módulo.
// - pretty solo en local (en staging/prod se emite JSON de una línea, ideal para
//   que el recolector de logs del contenedor lo parsee).
// - redact activado en TODOS los entornos (al pasar un objeto, no solo en prod):
//   enmascara secretos/PII (tarjetas, teléfono, JWT, Bearer, IBAN) tanto en
//   consola como antes del drain. Se EXCLUYEN a propósito dos patrones:
//     · `ipv4`: la IP del cliente es un dato de auditoría clave (detección de
//       fuerza bruta, accesos sospechosos) y debe conservarse íntegra;
//     · `email`: en un identity server el email del intento de login es
//       información útil de auditoría y se quiere ver completo.
//   Además, `paths` enmascara claves sensibles a cualquier profundidad del
//   evento (defensa en profundidad sobre los campos error/extra/requestBody).
// - El drain manda además cada evento al Redis Stream para persistirlo en BD.
//
// Inocuo fuera del servidor (p. ej. scripts/generate-openapi.ts, que importa la
// app): initLogger solo fija configuración global; el cliente de Redis conecta
// de forma perezosa y el drain solo se dispara ante peticiones reales.
initLogger({
  env: { service: "elineas-auth", environment: env.APP_ENV },
  pretty: env.APP_ENV === "local",
  redact: {
    builtins: ["creditCard", "phone", "jwt", "bearer", "iban"],
    paths: ["**.password", "**.token", "**.secret", "**.authorization", "**.cookie"],
  },
  drain: requestLogDrain,
});
