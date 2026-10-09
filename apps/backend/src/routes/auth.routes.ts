import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { requireSession } from "@backend/middleware/session.ts";
import { requireAdmin } from "@backend/middleware/admin.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import {
  AuthResultSchema,
  GoogleExchangeBodySchema,
  GoogleStartQuerySchema,
  JwksResponseSchema,
  SignInBodySchema,
  SetPasswordBodySchema,
  SetPasswordResponseSchema,
  SignUpBodySchema,
  SuccessResponseSchema,
  TokenResponseSchema,
  VerifyEmailBodySchema,
  VerifyEmailResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  conflictResponse,
  forbiddenResponse,
  serviceUnavailableResponse,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import {
  googleCallbackFn,
  googleExchangeFn,
  googleFinishFn,
  googleStartFn,
} from "@backend/services/google-auth.service.ts";
import {
  getJwksFn,
  getTokenFn,
  signInFn,
  signOutFn,
  setPasswordFn,
  signUpFn,
  verifyEmailFn,
} from "@backend/services/auth.service.ts";

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
    // El `tkc` opcional traía un usuario del sistema externo ya enlazado a otra
    // persona (code "TKC_USERNAME_TAKEN").
    409: conflictResponse,
    // Traía credenciales de TKC y el servidor no tiene con qué cifrarlas.
    503: serviceUnavailableResponse,
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

// Confirmación del cambio de correo. Público (sin requireSession): el enlace se
// abre desde el correo del usuario, que puede no tener sesión activa; el token
// firmado es la credencial. El cambio de email solo se materializa aquí.
const verifyEmailRoute = createRoute({
  method: "post",
  path: "/verify-email",
  operationId: "verifyEmail",
  tags: ["Auth"],
  summary: "Confirmar el cambio de correo con el token de verificación",
  request: {
    body: {
      content: { "application/json": { schema: VerifyEmailBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Correo verificado y cambio aplicado",
      content: { "application/json": { schema: VerifyEmailResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

const setPasswordRoute = createRoute({
  method: "post",
  path: "/set-password",
  operationId: "setPassword",
  tags: ["Auth"],
  summary: "Establecer la contraseña de una cuenta invitada con el token del correo",
  description:
    "Público: el token de un solo uso (48 h) es la credencial. Al usarse se " +
    "invalida y se cierran las sesiones previas de la cuenta.",
  request: {
    body: { content: { "application/json": { schema: SetPasswordBodySchema } } },
  },
  responses: {
    200: {
      description: "Contraseña establecida",
      content: { "application/json": { schema: SetPasswordResponseSchema } },
    },
    400: badRequestResponse,
  },
});

const googleStartRoute = createRoute({
  method: "get",
  path: "/google/start",
  operationId: "authGoogleStart",
  tags: ["Auth"],
  summary: "Iniciar sesión con Google (redirect)",
  description:
    "Lo abre el NAVEGADOR de la app. Redirige a Google y, al terminar, devuelve al " +
    "usuario a `redirect_to` con `?code=...&state=...` o `?error=CODIGO` " +
    "(ACCOUNT_NOT_FOUND, NO_ROLES_IN_SYSTEM, SYSTEM_NOT_FOUND, GOOGLE_ACCESS_DENIED, " +
    "GOOGLE_AUTH_FAILED). Google nunca crea cuentas: el usuario debe existir ya " +
    "con ese correo. El código se canjea en POST /google/exchange.",
  request: { query: GoogleStartQuerySchema },
  responses: {
    302: { description: "Redirección a Google" },
    400: badRequestResponse,
    503: serviceUnavailableResponse,
  },
});

const googleExchangeRoute = createRoute({
  method: "post",
  path: "/google/exchange",
  operationId: "authGoogleExchange",
  tags: ["Auth"],
  summary: "Canjear el código del login con Google por la sesión",
  description:
    "Servidor a servidor. Código de un solo uso (60 s) más el `code_verifier` PKCE. " +
    "Devuelve lo mismo que /sign-in; el token de sesión largo va en la cabecera " +
    "`set-auth-token`.",
  request: {
    body: { content: { "application/json": { schema: GoogleExchangeBodySchema } } },
  },
  responses: {
    200: {
      description: "Sesión iniciada",
      content: { "application/json": { schema: AuthResultSchema } },
    },
    400: badRequestResponse,
    503: serviceUnavailableResponse,
  },
});

export const authRoutes = new OpenAPIHono<AppEnv>()
  .openapi(signUpRoute, signUpFn)
  .openapi(signInRoute, signInFn)
  .openapi(signOutRoute, signOutFn)
  .openapi(getTokenRoute, getTokenFn)
  .openapi(getJwksRoute, getJwksFn)
  .openapi(verifyEmailRoute, verifyEmailFn)
  .openapi(setPasswordRoute, setPasswordFn)
  .openapi(googleStartRoute, googleStartFn)
  .openapi(googleExchangeRoute, googleExchangeFn)
  // Internas (sin documentar): las recorre el navegador, no las llama ninguna app.
  .get("/google/finish", googleFinishFn)
  .on(["GET", "POST"], "/callback/google", googleCallbackFn);
