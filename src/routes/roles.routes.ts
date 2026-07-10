import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  CreateRoleBodySchema,
  IdParamSchema,
  RoleListQuerySchema,
  RoleSchema,
  UpdateRoleBodySchema,
} from "@/openapi/business.schemas";
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

export const rolesRoutes = new OpenAPIHono<AppEnv>();

// Todo el recurso requiere rol admin (lecturas incluidas). requireSession va
// primero porque requireAdmin usa el user que aquél puebla.
rolesRoutes.use("*", requireSession);
rolesRoutes.use("*", requireAdmin);

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listRoles",
  tags: ["Roles"],
  summary: "Listar roles (opcionalmente filtrados por sistema)",
  security: bearerAuthSecurity,
  request: { query: RoleListQuerySchema },
  responses: {
    200: {
      description: "Lista de roles",
      content: {
        "application/json": { schema: z.object({ roles: z.array(RoleSchema) }) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

rolesRoutes.openapi(listRoute, async (c) => {
  const { systemId } = c.req.valid("query");
  const roles = await listRoles({ systemId });
  return c.json({ roles }, 200);
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

rolesRoutes.openapi(getRoute, async (c) => {
  const { id } = c.req.valid("param");
  const role = await getRole(id);
  return c.json({ role }, 200);
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

rolesRoutes.openapi(createRouteDef, async (c) => {
  const body = c.req.valid("json");
  const role = await createRole(body);
  return c.json({ role }, 201);
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

rolesRoutes.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const role = await updateRole(id, body);
  return c.json({ role }, 200);
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

rolesRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  await deleteRole(id);
  return c.json({ status: true }, 200);
});
