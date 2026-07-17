import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Registro de peticiones HTTP. Es infraestructura de observabilidad, no dominio,
// por eso vive en su propio archivo (separado de business-schema.ts).
//
// El flujo: cada request emite un "wide event" (evlog) → se encola en un Redis
// Stream (fire-and-forget) → un worker lo drena en lotes a esta tabla. NO se
// almacenan cuerpos ni cabeceras sensibles (Authorization/Cookie): es una API
// de autenticación y el riesgo de filtrar credenciales no compensa.
export const requestLog = pgTable(
  "request_log",
  {
    // PK = ID de la entrada del Redis Stream (p. ej. "1721212345678-0"). Dos
    // propiedades clave: es monotónico por stream (buena localidad de inserción)
    // y hace idempotente al worker: si un XDEL falla tras un INSERT exitoso, la
    // relectura vuelve a insertar la misma fila y choca con esta PK, así que
    // onConflictDoNothing la ignora (semántica exactly-once sin coordinación).
    // No lleva $defaultFn: el id lo fija el worker con el del stream.
    id: text("id").primaryKey(),
    // Instante del evento. withTimezone a propósito (a diferencia de las fechas
    // de negocio del resto del esquema): un log es un momento absoluto en UTC.
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    // UUID por petición, expuesto en la respuesta como cabecera X-Request-Id
    // para poder correlacionar un log con un incidente reportado por el cliente.
    requestId: text("request_id").notNull(),
    method: text("method").notNull(),
    // Path real de la petición (con los valores concretos, p. ej. /api/users/42).
    path: text("path").notNull(),
    // Patrón de ruta matcheado (p. ej. /api/users/:id). Permite agrupar por
    // endpoint sin la explosión de cardinalidad del path real.
    routePath: text("route_path"),
    status: integer("status").notNull(),
    durationMs: real("duration_ms").notNull(),
    clientIp: text("client_ip"),
    userAgent: text("user_agent"),
    referer: text("referer"),
    origin: text("origin"),
    contentLength: integer("content_length"),
    // Usuario/sesión SIN FK a `user`/`session` a propósito: el historial debe
    // sobrevivir al borrado del usuario, y evitamos que un INSERT falle o
    // arrastre borrados en cascada. Solo se rellenan en rutas autenticadas.
    userId: text("user_id"),
    sessionId: text("session_id"),
    // Query params ya redactados (token/code/state/otp enmascarados).
    query: jsonb("query"),
    // Cuerpo de la petición, con las claves sensibles ya enmascaradas
    // (password, token, secret, …). Solo se captura para content-types textuales
    // (JSON, form) y hasta un tope de tamaño; nunca cuerpos binarios/multipart.
    requestBody: jsonb("request_body"),
    // { name, message } si el handler lanzó un error.
    error: jsonb("error"),
    // Resto del wide event que no tiene columna propia (nivel, service, campos
    // custom que las rutas añadan con log.set, duración formateada, etc.).
    extra: jsonb("extra"),
  },
  (table) => [
    // Rango temporal (listados "últimas N horas") y la purga por retención.
    index("request_log_ts_idx").on(table.ts),
    index("request_log_user_id_idx").on(table.userId),
    // Búsqueda directa por la cabecera X-Request-Id.
    index("request_log_request_id_idx").on(table.requestId),
    // "Errores recientes": filtra por status y ordena por fecha en un solo índice.
    index("request_log_status_ts_idx").on(table.status, table.ts),
  ],
);
