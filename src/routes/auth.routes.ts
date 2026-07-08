import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "../lib/auth.js";
import { requireSession } from "../middleware/session.js";
import { forwardAuthHeaders, handleAuthError, issueJwt } from "../lib/http.js";
import type { AppEnv } from "../types/hono-env.js";
import {
  AuthResultSchema,
  JwksResponseSchema,
  SessionSchema,
  SuccessResponseSchema,
  TokenResponseSchema,
  UserSchema,
  badRequestResponse,
  bearerAuthSecurity,
  unauthorizedResponse,
} from "../openapi/schemas.js";

export const authRoutes = new OpenAPIHono<AppEnv>();

const SignUpBodySchema = z
  .object({
    name: z.string().openapi({ example: "Ada Lovelace" }),
    email: z.email().openapi({ example: "ada@mercadoelineas.com" }),
    password: z.string().min(1).openapi({ example: "super-secreta" }),
    image: z.string().optional(),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
  })
  .openapi("SignUpBody");

const SignInBodySchema = z
  .object({
    email: z.string().openapi({ example: "ada@mercadoelineas.com" }),
    password: z.string().openapi({ example: "super-secreta" }),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
  })
  .openapi("SignInBody");

const signUpRoute = createRoute({
  method: "post",
  path: "/sign-up",
  tags: ["Auth"],
  summary: "Registrar un nuevo usuario",
  request: {
    body: { content: { "application/json": { schema: SignUpBodySchema } } },
  },
  responses: {
    200: {
      description: "Usuario creado",
      content: { "application/json": { schema: AuthResultSchema } },
    },
    400: badRequestResponse,
  },
});

authRoutes.openapi(signUpRoute, async (c) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.signUpEmail({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const signInRoute = createRoute({
  method: "post",
  path: "/sign-in",
  tags: ["Auth"],
  summary: "Iniciar sesión con email y contraseña",
  request: {
    body: { content: { "application/json": { schema: SignInBodySchema } } },
  },
  responses: {
    200: {
      description: "Sesión iniciada",
      content: { "application/json": { schema: AuthResultSchema } },
    },
    400: badRequestResponse,
  },
});

authRoutes.openapi(signInRoute, async (c) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.signInEmail({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const signOutRoute = createRoute({
  method: "post",
  path: "/sign-out",
  tags: ["Auth"],
  summary: "Cerrar la sesión actual",
  security: bearerAuthSecurity,
  middleware: [requireSession],
  responses: {
    200: {
      description: "Sesión cerrada",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    401: unauthorizedResponse,
  },
});

authRoutes.openapi(signOutRoute, async (c) => {
  try {
    const { headers, response } = await auth.api.signOut({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const getSessionRoute = createRoute({
  method: "get",
  path: "/session",
  tags: ["Auth"],
  summary: "Obtener el usuario y la sesión actuales",
  security: bearerAuthSecurity,
  middleware: [requireSession],
  responses: {
    200: {
      description: "Sesión activa",
      content: {
        "application/json": {
          schema: z.object({ user: UserSchema, session: SessionSchema }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

authRoutes.openapi(getSessionRoute, (c) => {
  return c.json({ user: c.get("user"), session: c.get("session") }, 200);
});

const getTokenRoute = createRoute({
  method: "get",
  path: "/token",
  tags: ["Auth"],
  summary: "Obtener un JWT para la sesión actual",
  security: bearerAuthSecurity,
  middleware: [requireSession],
  responses: {
    200: {
      description: "Token emitido",
      content: { "application/json": { schema: TokenResponseSchema } },
    },
    401: unauthorizedResponse,
  },
});

authRoutes.openapi(getTokenRoute, async (c) => {
  try {
    const { token } = await auth.api.getToken({ headers: c.req.raw.headers });
    return c.json({ token }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const getJwksRoute = createRoute({
  method: "get",
  path: "/jwks",
  tags: ["Auth"],
  summary: "Obtener el JSON Web Key Set público",
  responses: {
    200: {
      description: "Conjunto de claves públicas",
      content: { "application/json": { schema: JwksResponseSchema } },
    },
  },
});

authRoutes.openapi(getJwksRoute, async (c) => {
  const jwks = await auth.api.getJwks();
  return c.json(jwks, 200);
});
