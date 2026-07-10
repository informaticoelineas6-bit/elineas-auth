import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import type { AppEnv } from "@/types/hono-env";
import {
  SessionSchema,
  StatusResponseSchema,
  UserSchema,
  badRequestResponse,
  bearerAuthSecurity,
  unauthorizedResponse,
} from "@/openapi/schemas";
import { SystemSchema } from "@/openapi/business.schemas";
import {
  getSessionFn,
  listSessionsFn,
  revokeAllFn,
  revokeOneFn,
  revokeOthersFn,
} from "@/services/session.service";

export const sessionsRoutes = new OpenAPIHono<AppEnv>();

sessionsRoutes.use("*", requireSession);

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
            session: SessionSchema,
            system: SystemSchema.nullable(),
          }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

sessionsRoutes.openapi(getSessionRoute, getSessionFn);

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
          schema: z.object({ sessions: z.array(SessionSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

sessionsRoutes.openapi(listSessionsRoute, listSessionsFn);

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

sessionsRoutes.openapi(revokeOthersRoute, revokeOthersFn);

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

sessionsRoutes.openapi(revokeAllRoute, revokeAllFn);

const revokeOneRoute = createRoute({
  method: "delete",
  path: "/{token}",
  operationId: "revokeSession",
  tags: ["Sessions"],
  summary: "Revocar una sesión específica por su token",
  security: bearerAuthSecurity,
  request: {
    params: z.object({
      token: z.string().openapi({
        param: { name: "token", in: "path" },
        example: "sess_abc123",
      }),
    }),
  },
  responses: {
    200: {
      description: "Sesión revocada",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    404: badRequestResponse,
  },
});

sessionsRoutes.openapi(revokeOneRoute, revokeOneFn);
