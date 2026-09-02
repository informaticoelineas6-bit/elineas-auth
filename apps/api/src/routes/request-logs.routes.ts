import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import { PaginationSchema } from "@/openapi/business.schemas";
import {
  RequestLogListQuerySchema,
  RequestLogSchema,
} from "@/openapi/logs.schemas";
import { paginationMeta } from "@/lib/pagination";
import { bearerAuthSecurity, forbiddenResponse, unauthorizedResponse } from "@/openapi/schemas";
import { listRequestLogs } from "@/services/request-log.service";

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listRequestLogs",
  tags: ["Logs"],
  summary:
    "Listar logs de peticiones (paginado; filtrable por fecha, usuario, status, método y path)",
  security: bearerAuthSecurity,
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

// Solo admin (mismo patrón que systems.routes.ts): requireSession puebla el user
// y requireAdmin comprueba el rol. Se registran sobre la instancia base para no
// romper la inferencia de tipos del cliente RPC.
const requestLogsRoutesBase = new OpenAPIHono<AppEnv>();
requestLogsRoutesBase.use("*", requireSession);
requestLogsRoutesBase.use("*", requireAdmin);

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
