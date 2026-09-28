import { requireAdmin } from "@backend/middleware/admin.ts";
import { requireIdentity } from "@backend/middleware/identity.ts";
import { requireSession } from "@backend/middleware/session.ts";
import {
  AssignPermissionBodySchema,
  IdParamSchema,
  MyPermissionSchema,
  MyPermissionsQuerySchema,
  PermissionRoleParamSchema,
  PermissionSchema,
  PermissionSystemParamSchema,
  SystemPermissionsSchema,
  UpdatePermissionBodySchema,
} from "@backend/openapi/business.schemas.ts";
import {
  badRequestResponse,
  bearerAuthSecurity,
  forbiddenResponse,
  notFoundResponse,
  StatusResponseSchema,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import {
  assignPermission,
  assignPermissionToRole,
  deletePermission,
  listMyPermissions,
  listPermissions,
  listPermissionsBySystem,
  removePermissionFromSystem,
  unassignPermissionFromRole,
  updatePermission,
} from "@backend/services/permission.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const meRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "listMyPermissions",
  tags: ["Permissions"],
  summary:
    "Listar los permisos efectivos del usuario autenticado en un sistema",
  description:
    "Sin `systemSlug`, resuelve los permisos en el sistema `auth`. Cualquier " +
    "sistema consumidor puede pedir los suyos, igual que en GET " +
    "/api/user-roles/me. Si el usuario tiene el rol admin en el sistema `auth` " +
    "o en el propio `systemSlug` consultado, devuelve el catálogo completo " +
    "(comodín global y comodín local, respectivamente). Es lo que cada panel " +
    "usa para decidir qué secciones mostrar/ocultar.",
  security: bearerAuthSecurity,
  // Acepta sesión O JWT propio del IS, igual que GET /api/user-roles/me: es
  // información sobre uno mismo, de riesgo bajo, y los backends consumidores
  // también pueden necesitarla.
  middleware: [requireIdentity] as const,
  request: { query: MyPermissionsQuerySchema },
  responses: {
    200: {
      description: "Permisos efectivos del usuario",
      content: {
        "application/json": {
          schema: z.object({ permissions: z.array(MyPermissionSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listPermissions",
  tags: ["Permissions"],
  summary: "Listar el catálogo completo de permisos (resource:action)",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  responses: {
    200: {
      description: "Catálogo de permisos",
      content: {
        "application/json": {
          schema: z.object({ permissions: z.array(PermissionSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const bySystemRoute = createRoute({
  method: "get",
  path: "/by-system",
  operationId: "listPermissionsBySystem",
  tags: ["Permissions"],
  summary: "Listar los permisos agrupados por sistema",
  description:
    "Un sistema por card, con los permisos (resource:action) asignados a " +
    "cualquiera de sus roles y en qué roles concretos de ese sistema quedó " +
    "cada uno. Pensado para la vista de administración de permisos.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  responses: {
    200: {
      description: "Permisos agrupados por sistema",
      content: {
        "application/json": {
          schema: z.object({ systems: z.array(SystemPermissionsSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const assignRoute = createRoute({
  method: "post",
  path: "/assign",
  operationId: "assignPermission",
  tags: ["Permissions"],
  summary: "Crear (o reutilizar) un permiso y asignarlo a un rol de un sistema",
  description:
    "`roleId` debe pertenecer a `systemId`. Si el permiso `resource:action` " +
    "ya existe en el catálogo se reutiliza; si no, se crea. Es la vía del " +
    "panel para 'crear un permiso para un sistema' sin tocar la API a mano.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: {
    body: {
      content: { "application/json": { schema: AssignPermissionBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Permiso asignado",
      content: {
        "application/json": {
          schema: z.object({ permission: PermissionSchema }),
        },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/{id}",
  operationId: "updatePermission",
  tags: ["Permissions"],
  summary: "Actualizar un permiso del catálogo",
  description:
    "El permiso es global: editar resource/action/description afecta a " +
    "todos los sistemas que lo tengan asignado, no solo al que se esté viendo.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: UpdatePermissionBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Permiso actualizado",
      content: {
        "application/json": {
          schema: z.object({ permission: PermissionSchema }),
        },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  operationId: "deletePermission",
  tags: ["Permissions"],
  summary: "Eliminar un permiso del catálogo (y sus asignaciones a roles)",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Permiso eliminado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const removeFromSystemRoute = createRoute({
  method: "delete",
  path: "/{id}/systems/{systemId}",
  operationId: "removePermissionFromSystem",
  tags: ["Permissions"],
  summary: "Quitar un permiso de un sistema (badge 'eliminar' en el panel)",
  description:
    "Desasigna el permiso de todos los roles de `systemId`. Si tras eso no " +
    "queda asignado a ningún rol de ningún otro sistema, también se borra " +
    "del catálogo (`deleted: true` en la respuesta).",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: PermissionSystemParamSchema },
  responses: {
    200: {
      description: "Permiso desasignado del sistema",
      content: {
        "application/json": { schema: z.object({ deleted: z.boolean() }) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const assignRoleRoute = createRoute({
  method: "put",
  path: "/{id}/roles/{roleId}",
  operationId: "assignPermissionToRole",
  tags: ["Permissions"],
  summary: "Asignar un permiso ya existente del catálogo a un rol",
  description:
    "Alta idempotente: si el rol ya tenía el permiso, no hace nada. Es el " +
    "control fino del panel de edición (roles concretos de un sistema que " +
    "llevan un permiso dado).",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: PermissionRoleParamSchema },
  responses: {
    200: {
      description: "Permiso asignado al rol",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const unassignRoleRoute = createRoute({
  method: "delete",
  path: "/{id}/roles/{roleId}",
  operationId: "unassignPermissionFromRole",
  tags: ["Permissions"],
  summary: "Quitar un permiso de un rol puntual",
  description:
    "Solo quita esta asignación rol↔permiso; a diferencia de DELETE " +
    "/{id}/systems/{systemId}, NO borra el permiso del catálogo aunque quede " +
    "sin ningún rol.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: PermissionRoleParamSchema },
  responses: {
    200: {
      description: "Permiso quitado del rol",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// `/me` es de cualquier usuario autenticado (sus propios permisos); el resto
// de operaciones (catálogo, alta/edición/borrado, vista por sistema) siguen
// siendo solo admin, igual que antes.
const permissionsRoutesBase = new OpenAPIHono<AppEnv>();

export const permissionsRoutes = permissionsRoutesBase
  .openapi(meRoute, async (c) => {
    const { systemSlug } = c.req.valid("query");
    const permissions = await listMyPermissions(c.get("user").id, systemSlug);
    return c.json({ permissions }, 200);
  })
  .openapi(listRoute, async (c) => {
    const permissions = await listPermissions();
    return c.json({ permissions }, 200);
  })
  .openapi(bySystemRoute, async (c) => {
    const systems = await listPermissionsBySystem();
    return c.json({ systems }, 200);
  })
  .openapi(assignRoute, async (c) => {
    const body = c.req.valid("json");
    const permission = await assignPermission(body);
    return c.json({ permission }, 201);
  })
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const permission = await updatePermission(id, body);
    return c.json({ permission }, 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deletePermission(id);
    return c.json({ status: true }, 200);
  })
  .openapi(removeFromSystemRoute, async (c) => {
    const { id, systemId } = c.req.valid("param");
    const { deleted } = await removePermissionFromSystem(id, systemId);
    return c.json({ deleted }, 200);
  })
  .openapi(assignRoleRoute, async (c) => {
    const { id, roleId } = c.req.valid("param");
    await assignPermissionToRole(roleId, id);
    return c.json({ status: true }, 200);
  })
  .openapi(unassignRoleRoute, async (c) => {
    const { id, roleId } = c.req.valid("param");
    await unassignPermissionFromRole(roleId, id);
    return c.json({ status: true }, 200);
  });
