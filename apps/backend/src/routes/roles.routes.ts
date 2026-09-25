import { paginationMeta } from "@backend/lib/pagination.ts";
import { requireAdmin } from "@backend/middleware/admin.ts";
import { requireSession } from "@backend/middleware/session.ts";
import {
  CreateRoleBodySchema,
  IdParamSchema,
  PaginationSchema,
  RoleListQuerySchema,
  RolePermissionSchema,
  RoleSchema,
  SetRolePermissionsBodySchema,
  UpdateRoleBodySchema,
} from "@backend/openapi/business.schemas.ts";
import {
  badRequestResponse,
  bearerAuthSecurity,
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  StatusResponseSchema,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import {
  listRolePermissions,
  setRolePermissions,
} from "@backend/services/permission.service.ts";
import {
  createRole,
  deleteRole,
  getRole,
  listRoles,
  updateRole,
} from "@backend/services/role.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listRoles",
  tags: ["Roles"],
  summary: "Listar roles (paginado, filtrable por sistema y búsqueda)",
  security: bearerAuthSecurity,
  request: { query: RoleListQuerySchema },
  responses: {
    200: {
      description: "Lista de roles",
      content: {
        "application/json": {
          schema: z.object({
            roles: z.array(RoleSchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/{id}",
  operationId: "getRole",
  tags: ["Roles"],
  summary: "Obtener un rol por id",
  security: bearerAuthSecurity,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Rol",
      content: {
        "application/json": { schema: z.object({ role: RoleSchema }) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  operationId: "createRole",
  tags: ["Roles"],
  summary: "Crear un rol",
  security: bearerAuthSecurity,
  request: {
    body: { content: { "application/json": { schema: CreateRoleBodySchema } } },
  },
  responses: {
    201: {
      description: "Rol creado",
      content: {
        "application/json": { schema: z.object({ role: RoleSchema }) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/{id}",
  operationId: "updateRole",
  tags: ["Roles"],
  summary: "Actualizar un rol",
  security: bearerAuthSecurity,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateRoleBodySchema } } },
  },
  responses: {
    200: {
      description: "Rol actualizado",
      content: {
        "application/json": { schema: z.object({ role: RoleSchema }) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  operationId: "deleteRole",
  tags: ["Roles"],
  summary: "Eliminar un rol",
  security: bearerAuthSecurity,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Rol eliminado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const getPermissionsRoute = createRoute({
  method: "get",
  path: "/{id}/permissions",
  operationId: "getRolePermissions",
  tags: ["Roles"],
  summary: "Listar los permisos asignados a un rol",
  security: bearerAuthSecurity,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Permisos del rol",
      content: {
        "application/json": {
          schema: z.object({ permissions: z.array(RolePermissionSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const setPermissionsRoute = createRoute({
  method: "put",
  path: "/{id}/permissions",
  operationId: "setRolePermissions",
  tags: ["Roles"],
  summary: "Reemplazar el conjunto completo de permisos de un rol",
  description:
    "Sustituye TODOS los permisos del rol por `permissionIds` ([] los quita todos). " +
    "El rol admin del sistema auth no necesita permisos aquí: siempre pasa como comodín.",
  security: bearerAuthSecurity,
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: SetRolePermissionsBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Permisos del rol tras la actualización",
      content: {
        "application/json": {
          schema: z.object({ permissions: z.array(RolePermissionSchema) }),
        },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// Todo el recurso requiere rol admin (lecturas incluidas). requireSession va
// primero porque requireAdmin usa el user que aquél puebla.
// El middleware se registra sobre la instancia base (no dentro de la cadena):
// OpenAPIHono.use() devuelve un `Hono` base sin `.openapi`, así que encadenarlo
// cortaría la inferencia de tipos del RPC. Registrado antes de las rutas, el
// orden de ejecución en runtime es el mismo (middleware primero).
const rolesRoutesBase = new OpenAPIHono<AppEnv>();
rolesRoutesBase.use("*", requireSession);
rolesRoutesBase.use("*", requireAdmin);

export const rolesRoutes = rolesRoutesBase
  .openapi(listRoute, async (c) => {
    const { systemId, search, page, limit } = c.req.valid("query");
    const { rows, total } = await listRoles(
      { systemId, search },
      { page, limit },
    );
    return c.json(
      { roles: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const role = await getRole(id);
    return c.json({ role }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const role = await createRole(body);
    return c.json({ role }, 201);
  })
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const role = await updateRole(id, body);
    return c.json({ role }, 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deleteRole(id);
    return c.json({ status: true }, 200);
  })
  .openapi(getPermissionsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const permissions = await listRolePermissions(id);
    return c.json({ permissions }, 200);
  })
  .openapi(setPermissionsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { permissionIds } = c.req.valid("json");
    const permissions = await setRolePermissions(id, permissionIds);
    return c.json({ permissions }, 200);
  });
