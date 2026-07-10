import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  CreateUserRoleBodySchema,
  IdParamSchema,
  MyUserRoleSchema,
  MyUserRolesQuerySchema,
  UserRoleListQuerySchema,
  UserRoleSchema,
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
  createUserRole,
  deleteUserRole,
  getUserRole,
  listMyRoles,
  listUserRoles,
} from "@/services/user-role.service";

export const userRolesRoutes = new OpenAPIHono<AppEnv>();

// Todas las rutas requieren sesión; el resto del recurso (lecturas y
// escrituras sobre asignaciones ajenas) exige además rol admin por ruta, ya
// que revela quién es admin — información sensible que no debe exponerse a
// sesiones normales. La excepción es /me: cualquier usuario autenticado
// puede consultar SUS PROPIOS roles.
userRolesRoutes.use("*", requireSession);

const myRolesRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "listMyUserRoles",
  tags: ["UserRoles"],
  summary: "Listar los roles del usuario autenticado (opcionalmente filtrados por sistema)",
  security: bearerAuthSecurity,
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

userRolesRoutes.openapi(myRolesRoute, async (c) => {
  const { systemSlug } = c.req.valid("query");
  const user = c.get("user");
  const roles = await listMyRoles(user.id, systemSlug);
  return c.json({ roles }, 200);
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listUserRoles",
  tags: ["UserRoles"],
  summary: "Listar asignaciones de roles (filtrable por usuario o rol)",
  security: bearerAuthSecurity,
  middleware: [requireAdmin] as const,
  request: { query: UserRoleListQuerySchema },
  responses: {
    200: {
      description: "Lista de asignaciones",
      content: {
        "application/json": {
          schema: z.object({ userRoles: z.array(UserRoleSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

userRolesRoutes.openapi(listRoute, async (c) => {
  const { userId, roleId } = c.req.valid("query");
  const userRoles = await listUserRoles({ userId, roleId });
  return c.json({ userRoles }, 200);
});

const getRoute = createRoute({
  method: "get",
  path: "/{id}",
  operationId: "getUserRole",
  tags: ["UserRoles"],
  summary: "Obtener una asignación por id",
  security: bearerAuthSecurity,
  middleware: [requireAdmin] as const,
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

userRolesRoutes.openapi(getRoute, async (c) => {
  const { id } = c.req.valid("param");
  const userRole = await getUserRole(id);
  return c.json({ userRole }, 200);
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  operationId: "createUserRole",
  tags: ["UserRoles"],
  summary: "Asignar un rol a un usuario",
  security: bearerAuthSecurity,
  middleware: [requireAdmin] as const,
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

userRolesRoutes.openapi(createRouteDef, async (c) => {
  const body = c.req.valid("json");
  const userRole = await createUserRole(body);
  return c.json({ userRole }, 201);
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  operationId: "deleteUserRole",
  tags: ["UserRoles"],
  summary: "Quitar un rol a un usuario",
  security: bearerAuthSecurity,
  middleware: [requireAdmin] as const,
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

userRolesRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  await deleteUserRole(id);
  return c.json({ status: true }, 200);
});
