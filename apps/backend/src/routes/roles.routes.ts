import { paginationMeta } from "@backend/lib/pagination.ts";
import { env } from "@backend/config/env.ts";
import { HttpError } from "@backend/lib/http.ts";
import { requireIdentity } from "@backend/middleware/identity.ts";
import { requireSystemManager } from "@backend/middleware/system-admin.ts";
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
  assertCanManageSystem,
  scopeFilter,
} from "@backend/services/system-admin.service.ts";
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

// Todo el recurso exige administrar algún sistema (superadmin o rol admin en
// un sistema); cada handler acota el rol concreto al alcance del usuario
// (assertCanManageSystem / scopeFilter). requireIdentity acepta sesión o el
// JWT del IS: es la API delegada que consumen los sistemas externos.
// El middleware se registra sobre la instancia base (no dentro de la cadena):
// OpenAPIHono.use() devuelve un `Hono` base sin `.openapi`, así que encadenarlo
// cortaría la inferencia de tipos del RPC. Registrado antes de las rutas, el
// orden de ejecución en runtime es el mismo (middleware primero).
const rolesRoutesBase = new OpenAPIHono<AppEnv>();
rolesRoutesBase.use("*", requireIdentity);
rolesRoutesBase.use("*", requireSystemManager);

// El rol admin de un sistema solo lo puede renombrar o borrar el superadmin:
// un admin delegado no debe poder desmontar su propio comodín local.
function assertNotAdminRoleEdit(
  scope: { all: boolean },
  roleName: string,
  what: string,
) {
  if (!scope.all && roleName === env.ADMIN_ROLE_NAME) {
    throw new HttpError(
      409,
      `Solo un superadmin puede ${what} el rol "${roleName}"`,
      "CONFLICT",
    );
  }
}

export const rolesRoutes = rolesRoutesBase
  .openapi(listRoute, async (c) => {
    const { systemId, search, page, limit, sortBy, sortDir } = c.req.valid("query");
    const systemIds = scopeFilter(c.get("manageScope"), systemId);
    const { rows, total } = await listRoles(
      { systemIds, search },
      { page, limit },
      { sortBy, sortDir },
    );
    return c.json(
      { roles: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const role = await getRole(id);
    assertCanManageSystem(c.get("manageScope"), role.systemId);
    return c.json({ role }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const scope = c.get("manageScope");
    assertCanManageSystem(scope, body.systemId);
    assertNotAdminRoleEdit(scope, body.name, "crear");
    const role = await createRole(body);
    return c.json({ role }, 201);
  })
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const scope = c.get("manageScope");
    const current = await getRole(id);
    assertCanManageSystem(scope, current.systemId);
    assertNotAdminRoleEdit(scope, current.name, "renombrar");
    if (body.name !== undefined) {
      assertNotAdminRoleEdit(scope, body.name, "crear");
    }
    const role = await updateRole(id, body);
    return c.json({ role }, 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    const scope = c.get("manageScope");
    const current = await getRole(id);
    assertCanManageSystem(scope, current.systemId);
    assertNotAdminRoleEdit(scope, current.name, "borrar");
    await deleteRole(id);
    return c.json({ status: true }, 200);
  })
  .openapi(getPermissionsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const current = await getRole(id);
    assertCanManageSystem(c.get("manageScope"), current.systemId);
    const permissions = await listRolePermissions(id);
    return c.json({ permissions }, 200);
  })
  .openapi(setPermissionsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { permissionIds } = c.req.valid("json");
    const current = await getRole(id);
    assertCanManageSystem(c.get("manageScope"), current.systemId);
    const permissions = await setRolePermissions(id, permissionIds);
    return c.json({ permissions }, 200);
  });
