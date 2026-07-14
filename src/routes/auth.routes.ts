import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  AuthResultSchema,
  JwksResponseSchema,
  SignInBodySchema,
  SignUpBodySchema,
  SuccessResponseSchema,
  TokenResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  forbiddenResponse,
  unauthorizedResponse,
} from "@/openapi/schemas";
import {
  getJwksFn,
  getTokenFn,
  signInFn,
  signOutFn,
  signUpFn,
} from "@/services/auth.service";

// El alta de cuentas NO es autoservicio: solo un admin puede crear usuarios.
// El primer admin se siembra con `bun run db:seed` (crea el usuario si no existe
// y le asigna el rol admin), evitando el problema de arranque.
const signUpRoute = createRoute({
  method: "post",
  path: "/sign-up",
  operationId: "authSignUp",
  tags: ["Auth"],
  summary: "Registrar un nuevo usuario (requiere rol admin)",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: {
    body: { content: { "application/json": { schema: SignUpBodySchema } } },
  },
  responses: {
    200: {
      description: "Usuario creado",
      content: { "application/json": { schema: AuthResultSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const signInRoute = createRoute({
  method: "post",
  path: "/sign-in",
  operationId: "authSignIn",
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
    403: forbiddenResponse,
  },
});

const signOutRoute = createRoute({
  method: "post",
  path: "/sign-out",
  operationId: "authSignOut",
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

const getTokenRoute = createRoute({
  method: "get",
  path: "/token",
  operationId: "authGetToken",
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

const getJwksRoute = createRoute({
  method: "get",
  path: "/jwks",
  operationId: "authGetJwks",
  tags: ["Auth"],
  summary: "Obtener el JSON Web Key Set público",
  responses: {
    200: {
      description: "Conjunto de claves públicas",
      content: { "application/json": { schema: JwksResponseSchema } },
    },
  },
});

export const authRoutes = new OpenAPIHono<AppEnv>()
  .openapi(signUpRoute, signUpFn)
  .openapi(signInRoute, signInFn)
  .openapi(signOutRoute, signOutFn)
  .openapi(getTokenRoute, getTokenFn)
  .openapi(getJwksRoute, getJwksFn);
