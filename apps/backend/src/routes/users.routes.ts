import { requireAdmin } from "@backend/middleware/admin.ts";
import { requirePermission } from "@backend/middleware/permission.ts";
import { requireSession } from "@backend/middleware/session.ts";
import { requireIdentity } from "@backend/middleware/identity.ts";
import { requireSystemManager } from "@backend/middleware/system-admin.ts";
import { paginationMeta } from "@backend/lib/pagination.ts";
import {
  IdParamSchema,
  ManagedUserListQuerySchema,
  ManagedUserSchema,
  PaginationSchema,
  UpdateManagedUserBodySchema,
  UserDirectoryEntrySchema,
  UserDirectoryQuerySchema,
} from "@backend/openapi/business.schemas.ts";
import {
  assertUserEditable,
  assertUserInScope,
  listManagedUsers,
  updateManagedUser,
} from "@backend/services/managed-user.service.ts";
import {
  AdminChangePasswordBodySchema,
  AdminChangePasswordResponseSchema,
  InviteResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  conflictResponse,
  ChangeEmailBodySchema,
  ChangeEmailResponseSchema,
  ChangePasswordBodySchema,
  ChangePasswordResponseSchema,
  forbiddenResponse,
  notFoundResponse,
  StatusResponseSchema,
  serviceUnavailableResponse,
  UpdateUserBodySchema,
  UserSchema,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import {
  adminChangeUserPassword,
  listUserDirectory,
  resendUserInvite,
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
  // Solo admin (no `users:write`): fijar la contraseña de otro usuario permite
  // tomar su cuenta, incluida la de un admin, así que no es delegable.
  middleware: [requireSession, requireAdmin] as const,
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

const resendInviteRoute = createRoute({
  method: "post",
  path: "/{id}/invite",
  operationId: "resendUserInvite",
  tags: ["Users"],
  summary: "Reenviar la invitación para establecer la contraseña (requiere users:write)",
  description:
    "Envía al correo del usuario un enlace de un solo uso (48 h) para que fije " +
    "su contraseña. El admin nunca ve ni fija la contraseña.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("users", "write")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Invitación enviada",
      content: { "application/json": { schema: InviteResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    503: serviceUnavailableResponse,
  },
});

const directoryRoute = createRoute({
  method: "get",
  path: "/directory",
  operationId: "listUserDirectory",
  tags: ["Users"],
  summary: "Directorio de usuarios para asignar roles (solo lectura)",
  description:
    "Lista paginada y buscable de todos los usuarios (id, nombre, correo, " +
    "estado). Para admins de sistema: les permite elegir a quién asignar un rol " +
    "de su sistema sin dar acceso al resto de datos del usuario.",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { query: UserDirectoryQuerySchema },
  responses: {
    200: {
      description: "Usuarios",
      content: {
        "application/json": {
          schema: z.object({
            users: z.array(UserDirectoryEntrySchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

// ---------------------------------------------------------------------------
// Usuarios de los sistemas que administro (administración delegada). Listar y
// gestionar roles cubre a cualquiera con rol en su sistema; editar datos o
// fijar la contraseña solo a cuentas cuyos roles caen TODOS en sus sistemas
// (ver assertUserEditable). Rutas bajo `/managed` para no solapar con las del
// superadmin (`/{id}/...`), que no cambian.
// ---------------------------------------------------------------------------
const managedListRoute = createRoute({
  method: "get",
  path: "/managed",
  operationId: "listManagedUsers",
  tags: ["Users"],
  summary: "Usuarios con rol en los sistemas que administro",
  description:
    "Paginado y buscable, filtrable por sistema. Cada usuario trae sus roles " +
    "dentro de tu alcance y `editable` (false si su cuenta es compartida con " +
    "otros sistemas: solo se le gestionan los roles de tu sistema).",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { query: ManagedUserListQuerySchema },
  responses: {
    200: {
      description: "Usuarios",
      content: {
        "application/json": {
          schema: z.object({
            users: z.array(ManagedUserSchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const managedUpdateRoute = createRoute({
  method: "patch",
  path: "/managed/{id}",
  operationId: "updateManagedUser",
  tags: ["Users"],
  summary: "Editar nombre, correo y ficha de empleado de un usuario de mi sistema",
  description:
    "Solo si todos los roles del usuario están en sistemas que administras " +
    "(403 `USER_SHARED` si no).",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: UpdateManagedUserBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Usuario actualizado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
});

const managedChangePasswordRoute = createRoute({
  method: "post",
  path: "/managed/{id}/change-password",
  operationId: "changeManagedUserPassword",
  tags: ["Users"],
  summary: "Fijar la contraseña de un usuario de mi sistema",
  description:
    "Mismas reglas que el cambio del superadmin (confirmas con TU contraseña, " +
    "se cierran sus sesiones), pero solo si todos los roles del usuario están " +
    "en sistemas que administras (403 `USER_SHARED` si no).",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
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
    409: conflictResponse,
  },
});

const managedInviteRoute = createRoute({
  method: "post",
  path: "/managed/{id}/invite",
  operationId: "resendManagedUserInvite",
  tags: ["Users"],
  summary: "Reenviar la invitación a un usuario de mi sistema",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Invitación enviada",
      content: { "application/json": { schema: InviteResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    503: serviceUnavailableResponse,
  },
});

const usersAdminRoutesBase = new OpenAPIHono<AppEnv>();

export const usersAdminRoutes = usersAdminRoutesBase
  .openapi(managedListRoute, async (c) => {
    const { search, systemId, page, limit } = c.req.valid("query");
    const { rows, total } = await listManagedUsers(
      c.get("manageScope"),
      { search, systemId },
      { page, limit },
    );
    return c.json(
      { users: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(managedUpdateRoute, async (c) => {
    const { id } = c.req.valid("param");
    await assertUserEditable(c.get("manageScope"), id);
    await updateManagedUser(id, c.req.valid("json"));
    return c.json({ status: true }, 200);
  })
  .openapi(managedChangePasswordRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { newPassword, currentPassword, revokeSessions } =
      c.req.valid("json");
    await assertUserEditable(c.get("manageScope"), id);
    const { revokedSessions } = await adminChangeUserPassword({
      adminUserId: c.get("user").id,
      targetUserId: id,
      newPassword,
      currentPassword,
      revokeSessions,
    });
    return c.json({ status: true, revokedSessions }, 200);
  })
  .openapi(managedInviteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await assertUserInScope(c.get("manageScope"), id);
    await resendUserInvite(id);
    return c.json({ status: true }, 200);
  })
  .openapi(directoryRoute, async (c) => {
    const { search, userId, page, limit } = c.req.valid("query");
    const { rows, total } = await listUserDirectory(
      { search, userId },
      { page, limit },
    );
    return c.json(
      { users: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
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
  .openapi(resendInviteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await resendUserInvite(id);
    return c.json({ status: true }, 200);
  });
