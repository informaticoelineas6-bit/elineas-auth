import { z } from "@hono/zod-openapi";
import { PaginationQuerySchema } from "@/openapi/business.schemas";

// Representación de una fila de request_log tal como se devuelve al cliente.
// Los campos jsonb (query/error/extra) se tipan laxos: su forma depende de cada
// petición y no aporta acotarla en el contrato.
export const RequestLogSchema = z
  .object({
    id: z.string(),
    ts: z.date(),
    requestId: z.string(),
    method: z.string(),
    path: z.string(),
    routePath: z.string().nullable(),
    status: z.number().int(),
    durationMs: z.number(),
    clientIp: z.string().nullable(),
    userAgent: z.string().nullable(),
    referer: z.string().nullable(),
    origin: z.string().nullable(),
    contentLength: z.number().int().nullable(),
    userId: z.string().nullable(),
    sessionId: z.string().nullable(),
    query: z.any().nullable(),
    requestBody: z.any().nullable(),
    error: z.any().nullable(),
    extra: z.any().nullable(),
  })
  .openapi("RequestLog");

// Filtros de listado. Todos opcionales; se combinan con AND. `from`/`to` acotan
// el rango temporal (por `ts`), `path` es coincidencia parcial.
export const RequestLogListQuerySchema = PaginationQuerySchema.extend({
  from: z.coerce.date().optional().openapi({
    param: { name: "from", in: "query", required: false },
    example: "2026-07-01T00:00:00.000Z",
  }),
  to: z.coerce.date().optional().openapi({
    param: { name: "to", in: "query", required: false },
    example: "2026-07-31T23:59:59.999Z",
  }),
  userId: z.string().optional().openapi({
    param: { name: "userId", in: "query", required: false },
  }),
  status: z.coerce.number().int().optional().openapi({
    param: { name: "status", in: "query", required: false },
    example: 500,
  }),
  method: z.string().optional().openapi({
    param: { name: "method", in: "query", required: false },
    example: "POST",
  }),
  // Coincidencia parcial sobre el path real (p. ej. "/api/auth").
  path: z.string().max(300).optional().openapi({
    param: { name: "path", in: "query", required: false },
    example: "/api/auth",
  }),
});
