import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "../lib/auth.js";
import { requireSession } from "../middleware/session.js";
import { forwardAuthHeaders, handleAuthError } from "../lib/http.js";
import type { AppEnv } from "../types/hono-env.js";
import {
  SessionSchema,
  StatusResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  unauthorizedResponse,
} from "../openapi/schemas.js";

export const sessionsRoutes = new OpenAPIHono<AppEnv>();

sessionsRoutes.use("*", requireSession);

const listSessionsRoute = createRoute({
  method: "get",
  path: "/",
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

sessionsRoutes.openapi(listSessionsRoute, async (c) => {
  try {
    const sessions = await auth.api.listSessions({ headers: c.req.raw.headers });
    return c.json({ sessions }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const revokeOthersRoute = createRoute({
  method: "delete",
  path: "/others",
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

sessionsRoutes.openapi(revokeOthersRoute, async (c) => {
  try {
    const { headers, response } = await auth.api.revokeOtherSessions({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const revokeAllRoute = createRoute({
  method: "delete",
  path: "/",
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

sessionsRoutes.openapi(revokeAllRoute, async (c) => {
  try {
    const { headers, response } = await auth.api.revokeSessions({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const revokeOneRoute = createRoute({
  method: "delete",
  path: "/{token}",
  tags: ["Sessions"],
  summary: "Revocar una sesión específica por su token",
  security: bearerAuthSecurity,
  request: {
    params: z.object({
      token: z.string().openapi({ param: { name: "token", in: "path" }, example: "sess_abc123" }),
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

sessionsRoutes.openapi(revokeOneRoute, async (c) => {
  try {
    const { token } = c.req.valid("param");
    const { headers, response } = await auth.api.revokeSession({
      body: { token },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});
