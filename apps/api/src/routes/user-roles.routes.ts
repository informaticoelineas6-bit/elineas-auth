import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireIdentity } from "@/middleware/identity";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  CreateUserRoleBodySchema,
  IdParamSchema,
  MyUserRoleSchema,
  MyUserRolesQuerySchema,
  PaginationSchema,
  UserRoleListQuerySchema,
  UserRoleSchema,
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
  createUserRole,
  deleteUserRole,
  getUserRole,
  listMyRoles,
  listUserRoles,
} from "@/services/user-role.service";

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
  middleware: [requireSession, requireAdmin] as const,
  request: { query: UserRoleListQuerySchema },
  responses: {
    200: {
      description: "Lista de asignaciones",
      content: {
        "application/json": {
          schema: z.object({
            userRoles: z.array(UserRoleSchema),
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
  middleware: [requireSession, requireAdmin] as const,
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
  middleware: [requireSession, requireAdmin] as const,
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
  middleware: [requireSession, requireAdmin] as const,
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
//   - resto (lecturas/escrituras sobre asignaciones ajenas): `requireSession` +
//     `requireAdmin`, ya que revela quién es admin — información sensible que no
//     debe exponerse a sesiones normales ni a JWTs stateless de vida corta.
const userRolesRoutesBase = new OpenAPIHono<AppEnv>();

export const userRolesRoutes = userRolesRoutesBase
  .openapi(myRolesRoute, async (c) => {
    const { systemSlug } = c.req.valid("query");
    const user = c.get("user");
    const roles = await listMyRoles(user.id, systemSlug);
    return c.json({ roles }, 200);
  })
  .openapi(listRoute, async (c) => {
    const { userId, roleId, page, limit } = c.req.valid("query");
    const { rows, total } = await listUserRoles({ userId, roleId }, { page, limit });
    return c.json(
      { userRoles: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userRole = await getUserRole(id);
    return c.json({ userRole }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const userRole = await createUserRole(body);
    return c.json({ userRole }, 201);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deleteUserRole(id);
    return c.json({ status: true }, 200);
  });
