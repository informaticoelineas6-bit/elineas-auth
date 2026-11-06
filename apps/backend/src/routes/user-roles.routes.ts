import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { env } from "@backend/config/env.ts";
import { requireIdentity } from "@backend/middleware/identity.ts";
import { requireSystemManager } from "@backend/middleware/system-admin.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import {
  CreateUserRoleBodySchema,
  IdParamSchema,
  MyUserRoleSchema,
  MyUserRolesQuerySchema,
  PaginationSchema,
  UserRoleListQuerySchema,
  UserRoleDetailSchema,
  UserRoleSchema,
} from "@backend/openapi/business.schemas.ts";
import { paginationMeta } from "@backend/lib/pagination.ts";
import {
  StatusResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import {
  assertCanManageSystem,
  invalidateManageScope,
  scopeFilter,
} from "@backend/services/system-admin.service.ts";
import { promoteToHeadEverywhere } from "@backend/services/department.service.ts";
import {
  createUserRole,
  deleteUserRole,
  getRoleScope,
  getUserRole,
  getUserRoleScope,
  listMyRoles,
  listUserRoles,
} from "@backend/services/user-role.service.ts";

const myRolesRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "listMyUserRoles",
  tags: ["UserRoles"],
  summary: "Listar los roles del usuario autenticado (opcionalmente filtrados por sistema)",
  security: bearerAuthSecurity,
  // Acepta sesión O JWT propio del IS: es el endpoint que los backends
  // consumidores usan (reenviando su Bearer JWT) para resolver roles.
  middleware: [requireIdentity] as const,
  request: { query: MyUserRolesQuerySchema },
  responses: {
    200: {
      description: "Roles del usuario autenticado",
      content: {
        "application/json": {
          schema: z.object({ roles: z.array(MyUserRoleSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listUserRoles",
  tags: ["UserRoles"],
  summary: "Listar asignaciones de roles (paginado, filtrable por usuario o rol)",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { query: UserRoleListQuerySchema },
  responses: {
    200: {
      description: "Lista de asignaciones",
      content: {
        "application/json": {
          schema: z.object({
            userRoles: z.array(UserRoleDetailSchema),
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
  operationId: "getUserRole",
  tags: ["UserRoles"],
  summary: "Obtener una asignación por id",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Asignación",
      content: {
        "application/json": { schema: z.object({ userRole: UserRoleSchema }) },
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
  operationId: "createUserRole",
  tags: ["UserRoles"],
  summary: "Asignar un rol a un usuario",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: {
    body: { content: { "application/json": { schema: CreateUserRoleBodySchema } } },
  },
  responses: {
    201: {
      description: "Rol asignado",
      content: {
        "application/json": { schema: z.object({ userRole: UserRoleSchema }) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  operationId: "deleteUserRole",
  tags: ["UserRoles"],
  summary: "Quitar un rol a un usuario",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Asignación eliminada",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// Autenticación por ruta (declarada en el `middleware` de cada createRoute, no
// con un `.use("*")` sobre la base: OpenAPIHono.use() devuelve un `Hono` base
// sin `.openapi`, que cortaría la inferencia de tipos del RPC):
//   - `/me`: `requireIdentity` (sesión O JWT del IS) — cualquier usuario
//     autenticado consulta SUS PROPIOS roles; es el endpoint que reenvían los
//     backends consumidores con su Bearer JWT.
//   - resto (lecturas/escrituras sobre asignaciones): `requireIdentity` +
//     `requireSystemManager`. Revela quién tiene qué rol, así que solo lo ve
//     quien administra algún sistema, y cada handler lo acota a los sistemas
//     de su alcance (el superadmin ve todo). Acepta JWT: es la API delegada
//     que usan los sistemas externos con el JWT de su admin.
const userRolesRoutesBase = new OpenAPIHono<AppEnv>();

export const userRolesRoutes = userRolesRoutesBase
  .openapi(myRolesRoute, async (c) => {
    const { systemSlug } = c.req.valid("query");
    const user = c.get("user");
    const roles = await listMyRoles(user.id, systemSlug);
    return c.json({ roles }, 200);
  })
  .openapi(listRoute, async (c) => {
    const { userId, roleId, systemId, page, limit, sortBy, sortDir } = c.req.valid("query");
    const systemIds = scopeFilter(c.get("manageScope"), systemId);
    const { rows, total } = await listUserRoles(
      { userId, roleId, systemIds },
      { page, limit },
      { sortBy, sortDir },
    );
    return c.json(
      { userRoles: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { systemId } = await getUserRoleScope(id);
    assertCanManageSystem(c.get("manageScope"), systemId);
    const userRole = await getUserRole(id);
    return c.json({ userRole }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const targetRole = await getRoleScope(body.roleId);
    assertCanManageSystem(c.get("manageScope"), targetRole.systemId);
    const userRole = await createUserRole(body);
    if (targetRole.name === env.ADMIN_ROLE_NAME) {
      await invalidateManageScope(body.userId);
      // Admin ⇒ jefe por defecto en los departamentos donde ya está.
      await promoteToHeadEverywhere(body.userId);
    }
    return c.json({ userRole }, 201);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    const target = await getUserRoleScope(id);
    assertCanManageSystem(c.get("manageScope"), target.systemId);
    await deleteUserRole(id);
    if (target.roleName === env.ADMIN_ROLE_NAME) {
      await invalidateManageScope(target.userId);
    }
    return c.json({ status: true }, 200);
  });
