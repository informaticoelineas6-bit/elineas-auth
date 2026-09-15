import { requireAdmin } from "@backend/middleware/admin.ts";
import { requireSession } from "@backend/middleware/session.ts";
import { IdParamSchema } from "@backend/openapi/business.schemas.ts";
import {
  AdminChangePasswordBodySchema,
  AdminChangePasswordResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  ChangeEmailBodySchema,
  ChangeEmailResponseSchema,
  ChangePasswordBodySchema,
  ChangePasswordResponseSchema,
  forbiddenResponse,
  notFoundResponse,
  serviceUnavailableResponse,
  StatusResponseSchema,
  TkcCredentialsBodySchema,
  TkcKeySummaryResponseSchema,
  UpdateUserBodySchema,
  UserSchema,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import {
  adminChangeUserPassword,
  changeEmailFn,
  changePasswordFn,
  getMeFn,
  updateMeFn,
} from "@backend/services/user.service.ts";
import {
  getUserTkcKeySummary,
  removeUserTkcCredentials,
  setUserTkcCredentials,
} from "@backend/services/tkc-key.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { HttpError } from "@backend/lib/http.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "getMe",
  tags: ["Users"],
  summary: "Obtener el perfil del usuario autenticado",
  security: bearerAuthSecurity,
  responses: {
    200: {
      description: "Perfil del usuario",
      content: {
        "application/json": { schema: z.object({ user: UserSchema }) },
      },
    },
    401: unauthorizedResponse,
  },
});

const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
  operationId: "updateMe",
  tags: ["Users"],
  summary: "Actualizar el perfil del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: { content: { "application/json": { schema: UpdateUserBodySchema } } },
  },
  responses: {
    200: {
      description: "Perfil actualizado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

const changePasswordRoute = createRoute({
  method: "post",
  path: "/me/change-password",
  operationId: "changePassword",
  tags: ["Users"],
  summary: "Cambiar la contraseña del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: {
      content: { "application/json": { schema: ChangePasswordBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Contraseña actualizada",
      content: { "application/json": { schema: ChangePasswordResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

const changeEmailRoute = createRoute({
  method: "post",
  path: "/me/change-email",
  operationId: "changeEmail",
  tags: ["Users"],
  summary: "Cambiar el email del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: {
      content: { "application/json": { schema: ChangeEmailBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Solicitud de cambio de email procesada",
      content: { "application/json": { schema: ChangeEmailResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

// El middleware se registra como sentencia sobre la instancia base (no dentro
// de la cadena): OpenAPIHono.use() devuelve un `Hono` base sin `.openapi`, así
// que encadenarlo cortaría la inferencia de tipos del RPC. Registrado antes de
// las rutas, el orden de ejecución en runtime es el mismo (middleware primero).
const usersRoutesBase = new OpenAPIHono<AppEnv>();
usersRoutesBase.use("*", requireSession);

export const usersRoutes = usersRoutesBase
  .openapi(getMeRoute, getMeFn)
  .openapi(updateMeRoute, updateMeFn)
  .openapi(changePasswordRoute, changePasswordFn)
  .openapi(changeEmailRoute, changeEmailFn);

// El auto-borrado de cuenta está deshabilitado (ver lib/auth.ts). La baja de un
// usuario la realiza un admin sobre el recurso correspondiente, no el propio
// usuario, por lo que no se expone un endpoint DELETE /me.

// ---------------------------------------------------------------------------
// Rutas administrativas sobre un usuario concreto
// ---------------------------------------------------------------------------
// Van en un sub-app aparte, montado en /api/users/admin (mismo patrón que
// sessionsAdminRoutes), y NO dentro de `usersRoutesBase`. El motivo es que
// `usersRoutesBase` solo exige requireSession —cualquier usuario autenticado
// consulta y edita su propio perfil— mientras estas exigen además requireAdmin.
// Colgarlas del mismo sub-app con un middleware por path no serviría: el patrón
// `/:id/change-password` también casa con `/me/change-password`, así que el
// cambio de contraseña propio acabaría pidiendo rol admin.
const adminChangePasswordRoute = createRoute({
  method: "post",
  path: "/{id}/change-password",
  operationId: "adminChangeUserPassword",
  tags: ["Users"],
  summary: "Cambiar la contraseña de otro usuario (requiere rol admin)",
  description:
    "Fija una contraseña nueva para el usuario indicado. El admin confirma con " +
    "SU propia contraseña; la del usuario objetivo no se necesita. Por defecto " +
    "cierra todas las sesiones de ese usuario.",
  security: bearerAuthSecurity,
  request: {
    params: IdParamSchema,
    body: {
      content: {
        "application/json": { schema: AdminChangePasswordBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "Contraseña actualizada",
      content: {
        "application/json": { schema: AdminChangePasswordResponseSchema },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// ---------------------------------------------------------------------------
// Credenciales del sistema externo TKC de un usuario
// ---------------------------------------------------------------------------
// Ninguna de las tres devuelve la contraseña de TKC, ni siquiera la de lectura.
// Un admin necesita saber QUÉ usuario de TKC tiene asignado cada persona y
// poder reemplazarlo; leer la contraseña no le hace falta para eso. Dejándola
// fuera, el secreto sale del servidor por un solo camino —el login de su
// propio dueño, ver POST /api/auth/sign-in— en vez de estar al alcance de
// cualquier sesión de admin que se comprometa.
const getTkcRoute = createRoute({
  method: "get",
  path: "/{id}/tkc",
  operationId: "getUserTkcKey",
  tags: ["Users"],
  summary: "Ver qué credencial de TKC tiene enlazada un usuario (requiere admin)",
  description:
    "Devuelve el usuario de TKC enlazado, SIN su contraseña. La contraseña " +
    "solo se entrega a su propio dueño al iniciar sesión.",
  security: bearerAuthSecurity,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Credencial enlazada (o null si no tiene)",
      content: {
        "application/json": { schema: TkcKeySummaryResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const setTkcRoute = createRoute({
  method: "put",
  path: "/{id}/tkc",
  operationId: "setUserTkcKey",
  tags: ["Users"],
  summary: "Fijar las credenciales de TKC de un usuario (requiere admin)",
  description:
    "Crea o reemplaza las credenciales. PUT y no PATCH porque la operación es " +
    "un reemplazo completo: usuario y contraseña van siempre juntos (una " +
    "contraseña sin su usuario no identifica ninguna cuenta de TKC).",
  security: bearerAuthSecurity,
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: TkcCredentialsBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Credenciales guardadas (se devuelven sin la contraseña)",
      content: {
        "application/json": { schema: TkcKeySummaryResponseSchema },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    503: serviceUnavailableResponse,
  },
});

const deleteTkcRoute = createRoute({
  method: "delete",
  path: "/{id}/tkc",
  operationId: "deleteUserTkcKey",
  tags: ["Users"],
  summary: "Desvincular las credenciales de TKC de un usuario (requiere admin)",
  security: bearerAuthSecurity,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Credenciales desvinculadas",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const usersAdminRoutesBase = new OpenAPIHono<AppEnv>();
usersAdminRoutesBase.use("*", requireSession);
usersAdminRoutesBase.use("*", requireAdmin);

export const usersAdminRoutes = usersAdminRoutesBase
  .openapi(adminChangePasswordRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { newPassword, currentPassword, revokeSessions } =
      c.req.valid("json");
    const { revokedSessions } = await adminChangeUserPassword({
      adminUserId: c.get("user").id,
      targetUserId: id,
      newPassword,
      currentPassword,
      revokeSessions,
    });
    return c.json({ status: true, revokedSessions }, 200);
  })
  .openapi(getTkcRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json({ tkc: await getUserTkcKeySummary(id) }, 200);
  })
  .openapi(setTkcRoute, async (c) => {
    const { id } = c.req.valid("param");
    const tkc = await setUserTkcCredentials(id, c.req.valid("json"));
    return c.json({ tkc }, 200);
  })
  .openapi(deleteTkcRoute, async (c) => {
    const { id } = c.req.valid("param");
    const removed = await removeUserTkcCredentials(id);
    if (!removed) {
      throw new HttpError(
        404,
        "El usuario no tiene credenciales de TKC enlazadas",
        "NOT_FOUND",
      );
    }
    return c.json({ status: true }, 200);
  });
