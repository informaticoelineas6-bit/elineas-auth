import { lt } from "drizzle-orm";
import { db } from "@/db/index";
import { requestLog } from "@/db/log-schema";
import { redis, redisCommand } from "@/lib/redis";
import { STREAM_KEY } from "@/lib/logging";
import { env } from "@/config/env";

// Cada cuánto se drena el stream a Postgres.
const DRAIN_INTERVAL_MS = 5_000;
// Entradas leídas por iteración del stream.
const BATCH_SIZE = 500;
// Tope de iteraciones por tick: evita monopolizar el event loop si el stream
// acumuló mucho. Lo pendiente se drena en el siguiente tick (el MAXLEN del
// stream acota el peor caso igualmente). 20 × 500 = 10 000 filas/tick.
const MAX_ITERATIONS_PER_TICK = 20;
// Timeout de los comandos de lectura del stream: más holgado que el default de
// redisCommand (250 ms) porque un XRANGE de 500 entradas es más pesado.
const READ_TIMEOUT_MS = 2_000;
const MS_PER_DAY = 24 * 60 * 60 * 1_000;
// Intervalo mínimo entre purgas por retención (una pasada al día basta).
const PURGE_INTERVAL_MS = MS_PER_DAY;

// Fila lista para insertar + el id del stream del que provino (para el XDEL).
type ParsedEntry = { streamId: string; row: typeof requestLog.$inferInsert };

// Columnas con nombre propio en la tabla. Todo lo demás del wide event va a
// `extra`. Se listan aquí para poder separarlas al construir `extra`.
const MAPPED_KEYS = new Set([
  "timestamp",
  "requestId",
  "method",
  "path",
  "routePath",
  "status",
  "durationMs",
  "clientIp",
  "userAgent",
  "referer",
  "origin",
  "contentLength",
  "userId",
  "sessionId",
  "query",
  "requestBody",
  "error",
]);

function toRow(streamId: string, event: Record<string, unknown>): ParsedEntry {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (!MAPPED_KEYS.has(key)) extra[key] = value;
  }
  const ts = typeof event.timestamp === "string" ? new Date(event.timestamp) : new Date();
  return {
    streamId,
    row: {
      id: streamId,
      ts,
      requestId: String(event.requestId ?? ""),
      method: String(event.method ?? ""),
      path: String(event.path ?? ""),
      routePath: typeof event.routePath === "string" ? event.routePath : null,
      status: Number(event.status ?? 0),
      durationMs: Number(event.durationMs ?? 0),
      clientIp: typeof event.clientIp === "string" ? event.clientIp : null,
      userAgent: typeof event.userAgent === "string" ? event.userAgent : null,
      referer: typeof event.referer === "string" ? event.referer : null,
      origin: typeof event.origin === "string" ? event.origin : null,
      contentLength:
        typeof event.contentLength === "number" ? event.contentLength : null,
      userId: typeof event.userId === "string" ? event.userId : null,
      sessionId: typeof event.sessionId === "string" ? event.sessionId : null,
      query: event.query ?? null,
      requestBody: event.requestBody ?? null,
      error: event.error ?? null,
      extra: Object.keys(extra).length ? extra : null,
    },
  };
}

// Extrae el JSON del campo "event" de una entrada de stream. El reply de XRANGE
// es [id, [campo1, valor1, campo2, valor2, ...]]; buscamos el valor de "event".
function extractEventJson(fields: unknown): string | null {
  if (!Array.isArray(fields)) return null;
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i] === "event") return String(fields[i + 1]);
  }
  return null;
}

// ¿Es un error de datos de Postgres (SQLSTATE de 5 caracteres)? Distingue una
// fila "envenenada" (que hay que descartar) de una caída de conexión (que debe
// abortar el tick y reintentar más tarde sin perder datos).
function isPgDataError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && code.length === 5;
}

// Inserta un lote y devuelve los ids del stream a borrar. Si el INSERT del lote
// falla, degrada a fila-a-fila: las filas válidas se guardan, una fila que
// dispare un error de DATOS se descarta (se marca para borrar y se loguea) para
// no atascar el stream; un error de CONEXIÓN se relanza para reintentar el tick.
async function insertBatch(entries: ParsedEntry[]): Promise<string[]> {
  if (entries.length === 0) return [];
  try {
    await db.insert(requestLog).values(entries.map((e) => e.row)).onConflictDoNothing();
    return entries.map((e) => e.streamId);
  } catch (batchError) {
    if (!isPgDataError(batchError)) throw batchError; // conexión: reintentar tick
    const toDelete: string[] = [];
    for (const entry of entries) {
      try {
        await db.insert(requestLog).values(entry.row).onConflictDoNothing();
        toDelete.push(entry.streamId);
      } catch (rowError) {
        if (!isPgDataError(rowError)) throw rowError;
        console.error(
          `request-log-worker: fila descartada (${entry.streamId}):`,
          rowError instanceof Error ? rowError.message : rowError,
        );
        toDelete.push(entry.streamId); // envenenada: descartar para no bloquear
      }
    }
    return toDelete;
  }
}

// Purga las filas más antiguas que la retención configurada. Barato gracias al
// índice sobre `ts`.
async function purgeOldLogs(): Promise<void> {
  if (env.REQUEST_LOG_RETENTION_DAYS <= 0) return;
  const cutoff = new Date(Date.now() - env.REQUEST_LOG_RETENTION_DAYS * MS_PER_DAY);
  await db.delete(requestLog).where(lt(requestLog.ts, cutoff));
}

// Arranca el worker de drenado. Devuelve un `stop()` que hace flush final y se
// engancha en el apagado ordenado (src/index.ts) ANTES de cerrar el pool/redis.
export function startRequestLogWorker(): { stop: () => Promise<void> } {
  // Sin Redis no hay stream que drenar: el logging queda solo en consola.
  if (!redis) {
    console.log(
      "request-log-worker: REDIS_URL no configurado; logging solo por consola.",
    );
    return { stop: async () => {} };
  }

  let running = false; // evita solapar ticks
  let stopped = false;
  let currentTick: Promise<void> | null = null;
  let lastPurgeAt = 0;

  // Una pasada de drenado: lee del stream en lotes, inserta y borra lo insertado.
  async function drain(): Promise<void> {
    for (let i = 0; i < MAX_ITERATIONS_PER_TICK; i++) {
      const reply = (await redisCommand(
        () => redis!.send("XRANGE", [STREAM_KEY, "-", "+", "COUNT", String(BATCH_SIZE)]),
        READ_TIMEOUT_MS,
      )) as Array<[string, unknown]> | null;

      if (!reply || reply.length === 0) return;

      const parsed: ParsedEntry[] = [];
      const badIds: string[] = [];
      for (const [streamId, fields] of reply) {
        const json = extractEventJson(fields);
        try {
          if (json === null) throw new Error("sin campo 'event'");
          parsed.push(toRow(streamId, JSON.parse(json) as Record<string, unknown>));
        } catch {
          // Entrada corrupta: no se puede parsear. Se descarta para no atascar
          // el stream (se borra más abajo junto con las insertadas).
          badIds.push(streamId);
        }
      }

      // El INSERT es lo único que puede fallar por causas externas (Postgres).
      // Si lanza, propaga y el tick se aborta SIN borrar nada del stream: las
      // entradas quedan y se reintentan en el próximo tick (no se pierden).
      const insertedIds = await insertBatch(parsed);

      const toDelete = [...insertedIds, ...badIds];
      if (toDelete.length > 0) {
        // Borrado tras la inserción. Si este XDEL fallara, la relectura futura
        // reinsertaría las mismas filas y chocaría con la PK (onConflictDoNothing
        // las ignora): idempotente, sin duplicados.
        await redisCommand(() => redis!.send("XDEL", [STREAM_KEY, ...toDelete]), READ_TIMEOUT_MS);
      }

      // Si el lote no vino lleno, el stream está vacío: terminamos el tick.
      if (reply.length < BATCH_SIZE) return;
    }
  }

  async function tick(): Promise<void> {
    if (running || stopped) return;
    running = true;
    try {
      await drain();
      // Purga por retención como mucho una vez al día.
      if (Date.now() - lastPurgeAt >= PURGE_INTERVAL_MS) {
        lastPurgeAt = Date.now();
        await purgeOldLogs();
      }
    } catch (error) {
      // Redis o Postgres caídos: se registra de forma concisa y se reintenta en
      // el siguiente tick. El circuit breaker de redisCommand evita pagar
      // timeouts repetidos mientras Redis esté caído.
      console.error(
        "request-log-worker: fallo drenando logs (se reintentará):",
        error instanceof Error ? error.message : error,
      );
    } finally {
      running = false;
    }
  }

  const interval = setInterval(() => {
    currentTick = tick();
  }, DRAIN_INTERVAL_MS);
  // No mantener vivo el proceso solo por este timer.
  if (typeof interval === "object" && "unref" in interval) interval.unref();

  return {
    async stop() {
      stopped = true;
      clearInterval(interval);
      // Espera el tick en vuelo (si lo hay) y hace un último flush para no dejar
      // en el stream lo ya recibido. Acotado por MAX_ITERATIONS_PER_TICK; si
      // falla, no pasa nada: el stream es persistente y se drena al reiniciar.
      if (currentTick) await currentTick.catch(() => {});
      try {
        await drain();
      } catch (error) {
        console.error(
          "request-log-worker: flush final incompleto:",
          error instanceof Error ? error.message : error,
        );
      }
    },
  };
}
