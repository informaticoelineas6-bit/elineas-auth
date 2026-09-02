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
  StatusResponseSchema,
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
import type { AppEnv } from "@backend/types/hono-env.ts";
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

const usersAdminRoutesBase = new OpenAPIHono<AppEnv>();
usersAdminRoutesBase.use("*", requireSession);
usersAdminRoutesBase.use("*", requireAdmin);

export const usersAdminRoutes = usersAdminRoutesBase.openapi(
  adminChangePasswordRoute,
  async (c) => {
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
  },
);
