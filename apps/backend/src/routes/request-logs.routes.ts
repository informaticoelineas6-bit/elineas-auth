import { paginationMeta } from "@backend/lib/pagination.ts";
import { requirePermission } from "@backend/middleware/permission.ts";
import { requireSession } from "@backend/middleware/session.ts";
import { PaginationSchema } from "@backend/openapi/business.schemas.ts";
import {
  RequestLogListQuerySchema,
  RequestLogSchema,
} from "@backend/openapi/logs.schemas.ts";
import {
  bearerAuthSecurity,
  forbiddenResponse,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import { listRequestLogs } from "@backend/services/request-log.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listRequestLogs",
  tags: ["Logs"],
  summary:
    "Listar logs de peticiones (paginado; filtrable por fecha, usuario, status, método y path)",
  security: bearerAuthSecurity,
  middleware: [
    requireSession,
    requirePermission("request-logs", "read"),
  ] as const,
  request: { query: RequestLogListQuerySchema },
  responses: {
    200: {
      description: "Lista de logs de peticiones",
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(RequestLogSchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

// Requiere el permiso "request-logs:read" (o el rol admin, comodín): permite
// delegar auditoría de seguridad a un rol de solo lectura sin darle privilegios
// de administrador. Declarado por ruta (ver nota en employees.routes.ts sobre
// por qué no se usa `.use("*", ...)` sobre la base).
const requestLogsRoutesBase = new OpenAPIHono<AppEnv>();

export const requestLogsRoutes = requestLogsRoutesBase.openapi(
  listRoute,
  async (c) => {
    const { from, to, userId, status, method, path, page, limit } =
      c.req.valid("query");
    const { rows, total } = await listRequestLogs(
      { from, to, userId, status, method, path },
      { page, limit },
    );
    return c.json(
      { logs: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  },
);
