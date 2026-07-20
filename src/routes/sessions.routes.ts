import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  AdminSafeSessionSchema,
  SafeSessionSchema,
  StatusResponseSchema,
  UserSchema,
  bearerAuthSecurity,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
} from "@/openapi/schemas";
import { PaginationSchema, SessionListQuerySchema } from "@/openapi/business.schemas";
import { SystemSchema } from "@/openapi/business.schemas";
import { paginationMeta } from "@/lib/pagination";
import {
  adminRevokeSession,
  getSessionFn,
  listAllSessions,
  listSessionsFn,
  revokeAllFn,
  revokeOneFn,
  revokeOthersFn,
} from "@/services/session.service";

const getSessionRoute = createRoute({
  method: "get",
  path: "/session",
  operationId: "getCurrentSession",
  tags: ["Auth"],
  summary: "Obtener el usuario y la sesión actuales",
  security: bearerAuthSecurity,
  responses: {
    200: {
      description: "Sesión activa",
      content: {
        "application/json": {
          schema: z.object({
            user: UserSchema,
            session: SafeSessionSchema,
            system: SystemSchema.nullable(),
          }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

const listSessionsRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listSessions",
  tags: ["Sessions"],
  summary: "Listar las sesiones activas del usuario",
  security: bearerAuthSecurity,
  responses: {
    200: {
      description: "Sesiones activas",
      content: {
        "application/json": {
          schema: z.object({ sessions: z.array(SafeSessionSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

const revokeOthersRoute = createRoute({
  method: "delete",
  path: "/others",
  operationId: "revokeOtherSessions",
  tags: ["Sessions"],
  summary: "Revocar todas las sesiones excepto la actual",
  security: bearerAuthSecurity,
  responses: {
    200: {
      description: "Sesiones revocadas",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
  },
});

const revokeAllRoute = createRoute({
  method: "delete",
  path: "/",
  operationId: "revokeAllSessions",
  tags: ["Sessions"],
  summary: "Revocar todas las sesiones del usuario",
  security: bearerAuthSecurity,
  responses: {
    200: {
      description: "Sesiones revocadas",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
  },
});

const revokeOneRoute = createRoute({
  method: "delete",
  path: "/revoke",
  operationId: "revokeSession",
  tags: ["Sessions"],
  summary: "Revocar una sesión específica por su id",
  // Se revoca por `id` (no por token): el listado de sesiones ya no expone el
  // token (secreto de portador), así que el cliente identifica la sesión a
  // revocar por su id. El propio better-auth solo permite revocar sesiones del
  // usuario autenticado, de modo que no se puede revocar la de otro.
  security: bearerAuthSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sessionId: z.string().openapi({ example: "sess_abc123" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sesión revocada",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
});

// --- Administrativo: sesiones de TODOS los usuarios --------------------
// Rutas aparte (montadas bajo /api/sessions/admin en routes/index.ts), no
// dentro de `sessionsRoutesBase`: requieren además `requireAdmin`, mientras
// que las de arriba las usa cualquier usuario autenticado sobre su propia
// sesión.
const listAllSessionsRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listAllSessions",
  tags: ["Sessions"],
  summary: "Listar las sesiones activas de todos los usuarios (admin)",
  security: bearerAuthSecurity,
  request: { query: SessionListQuerySchema },
  responses: {
    200: {
      description: "Sesiones activas de todos los usuarios",
      content: {
        "application/json": {
          schema: z.object({
            sessions: z.array(AdminSafeSessionSchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const adminRevokeRoute = createRoute({
  method: "delete",
  path: "/revoke",
  operationId: "adminRevokeSession",
  tags: ["Sessions"],
  summary: "Revocar por id la sesión de cualquier usuario (admin)",
  security: bearerAuthSecurity,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sessionId: z.string().openapi({ example: "sess_abc123" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sesión revocada",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const sessionsAdminRoutesBase = new OpenAPIHono<AppEnv>();
sessionsAdminRoutesBase.use("*", requireSession);
sessionsAdminRoutesBase.use("*", requireAdmin);

export const sessionsAdminRoutes = sessionsAdminRoutesBase
  .openapi(listAllSessionsRoute, async (c) => {
    const { page, limit, search } = c.req.valid("query");
    const { rows, total } = await listAllSessions({ search }, { page, limit });
    return c.json(
      { sessions: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(adminRevokeRoute, async (c) => {
    const { sessionId } = c.req.valid("json");
    await adminRevokeSession(sessionId);
    return c.json({ status: true }, 200);
  });

// El middleware se registra sobre la instancia base (no dentro de la cadena):
// OpenAPIHono.use() devuelve un `Hono` base sin `.openapi`, así que encadenarlo
// cortaría la inferencia de tipos del RPC. Registrado antes de las rutas, el
// orden de ejecución en runtime es el mismo (middleware primero).
const sessionsRoutesBase = new OpenAPIHono<AppEnv>();
sessionsRoutesBase.use("*", requireSession);

export const sessionsRoutes = sessionsRoutesBase
  .openapi(getSessionRoute, getSessionFn)
  .openapi(listSessionsRoute, listSessionsFn)
  .openapi(revokeOthersRoute, revokeOthersFn)
  .openapi(revokeAllRoute, revokeAllFn)
  .openapi(revokeOneRoute, revokeOneFn);
