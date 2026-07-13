import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  CreateRoleBodySchema,
  IdParamSchema,
  PaginationSchema,
  RoleListQuerySchema,
  RoleSchema,
  UpdateRoleBodySchema,
} from "@/openapi/business.schemas";
import { paginationMeta } from "@/lib/pagination";
import {
  StatusResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
} from "@/openapi/schemas";
import {
  createRole,
  deleteRole,
  getRole,
  listRoles,
  updateRole,
} from "@/services/role.service";

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
      content: { "application/json": { schema: z.object({ role: RoleSchema }) } },
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
      content: { "application/json": { schema: z.object({ role: RoleSchema }) } },
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
      content: { "application/json": { schema: z.object({ role: RoleSchema }) } },
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
    const { rows, total } = await listRoles({ systemId, search }, { page, limit });
    return c.json({ roles: rows, pagination: paginationMeta({ page, limit }, total) }, 200);
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
  });
