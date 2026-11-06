import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@backend/middleware/session.ts";
import { requireAdmin } from "@backend/middleware/admin.ts";
import { requireIdentity } from "@backend/middleware/identity.ts";
import { requireSystemManager } from "@backend/middleware/system-admin.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import {
  CreateSystemBodySchema,
  IdParamSchema,
  PaginationSchema,
  SystemListQuerySchema,
  SystemSchema,
  UpdateSystemBodySchema,
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
  getManageScope,
  listManagedSystems,
  scopeFilter,
} from "@backend/services/system-admin.service.ts";
import {
  getServiceKeyStatus,
  revokeServiceKey,
  rotateServiceKey,
} from "@backend/services/service-key.service.ts";
import {
  createSystem,
  deleteSystem,
  getSystem,
  listSystems,
  updateSystem,
} from "@backend/services/system.service.ts";

const managedRoute = createRoute({
  method: "get",
  path: "/managed",
  operationId: "listManagedSystems",
  tags: ["Systems"],
  summary: "Sistemas que el usuario autenticado puede administrar",
  description:
    "Superadmin (rol admin en `auth`): todos los sistemas. Admin de un sistema: solo esos. Sin rol admin en ninguno: lista vacía. Acepta sesión o JWT del IS.",
  security: bearerAuthSecurity,
  middleware: [requireIdentity] as const,
  responses: {
    200: {
      description: "Alcance de administración",
      content: {
        "application/json": {
          schema: z.object({
            isSuperAdmin: z.boolean(),
            systems: z.array(
              z.object({ id: z.uuid(), slug: z.string(), name: z.string() }),
            ),
          }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listSystems",
  tags: ["Systems"],
  summary: "Listar sistemas (paginado, filtrable por estado y búsqueda)",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { query: SystemListQuerySchema },
  responses: {
    200: {
      description: "Lista de sistemas",
      content: {
        "application/json": {
          schema: z.object({
            systems: z.array(SystemSchema),
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
  operationId: "getSystem",
  tags: ["Systems"],
  summary: "Obtener un sistema por id",
  security: bearerAuthSecurity,
  middleware: [requireIdentity, requireSystemManager] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Sistema",
      content: {
        "application/json": { schema: z.object({ system: SystemSchema }) },
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
  operationId: "createSystem",
  tags: ["Systems"],
  summary: "Crear un sistema",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: {
    body: { content: { "application/json": { schema: CreateSystemBodySchema } } },
  },
  responses: {
    201: {
      description: "Sistema creado",
      content: {
        "application/json": { schema: z.object({ system: SystemSchema }) },
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
  operationId: "updateSystem",
  tags: ["Systems"],
  summary: "Actualizar un sistema",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateSystemBodySchema } } },
  },
  responses: {
    200: {
      description: "Sistema actualizado",
      content: {
        "application/json": { schema: z.object({ system: SystemSchema }) },
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
  operationId: "deleteSystem",
  tags: ["Systems"],
  summary: "Eliminar un sistema",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Sistema eliminado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const ServiceKeyStatusSchema = z
  .object({ hasKey: z.boolean(), createdAt: z.date().nullable() })
  .openapi("ServiceKeyStatus");

const ServiceKeyCreatedSchema = z
  .object({
    key: z.string().openapi({ description: "Clave en claro. Solo se muestra esta vez." }),
    createdAt: z.date(),
  })
  .openapi("ServiceKeyCreated");

const getServiceKeyRoute = createRoute({
  method: "get",
  path: "/{id}/service-key",
  operationId: "getSystemServiceKey",
  tags: ["Systems"],
  summary: "Ver si el sistema tiene clave de servicio",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Estado de la clave (nunca la clave)",
      content: { "application/json": { schema: ServiceKeyStatusSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const rotateServiceKeyRoute = createRoute({
  method: "post",
  path: "/{id}/service-key",
  operationId: "rotateSystemServiceKey",
  tags: ["Systems"],
  summary: "Generar o rotar la clave de servicio del sistema",
  description:
    "Devuelve la clave una sola vez; en BD solo queda su hash. Rotarla invalida la anterior. " +
    "Se envía en `X-Service-Key` a POST /api/auth/sign-in en lugar del captcha.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: IdParamSchema },
  responses: {
    201: {
      description: "Clave generada",
      content: { "application/json": { schema: ServiceKeyCreatedSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const revokeServiceKeyRoute = createRoute({
  method: "delete",
  path: "/{id}/service-key",
  operationId: "revokeSystemServiceKey",
  tags: ["Systems"],
  summary: "Revocar la clave de servicio del sistema",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Clave revocada",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// Autenticación por ruta (en el `middleware` de cada createRoute; ver el
// comentario de user-roles.routes.ts sobre por qué no se usa `.use("*")`):
//   - lecturas (list/get): `requireIdentity` + `requireSystemManager`, acotadas
//     al alcance del usuario (un admin de `pos` solo ve `pos`).
//   - `/managed`: cualquier usuario autenticado consulta SU alcance.
//   - escrituras y service-key: `requireSession` + `requireAdmin` (superadmin).
//     Dar de alta, editar o borrar sistemas y sus claves nunca se delega.
const systemsRoutesBase = new OpenAPIHono<AppEnv>();

export const systemsRoutes = systemsRoutesBase
  .openapi(managedRoute, async (c) => {
    const scope = await getManageScope(c.get("user").id);
    return c.json(
      { isSuperAdmin: scope.all, systems: await listManagedSystems(scope) },
      200,
    );
  })
  .openapi(listRoute, async (c) => {
    const { active, search, page, limit, sortBy, sortDir } = c.req.valid("query");
    const { rows, total } = await listSystems(
      {
        active: active === undefined ? undefined : active === "true",
        search,
        ids: scopeFilter(c.get("manageScope")),
      },
      { page, limit },
      { sortBy, sortDir },
    );
    return c.json({ systems: rows, pagination: paginationMeta({ page, limit }, total) }, 200);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    assertCanManageSystem(c.get("manageScope"), id);
    const system = await getSystem(id);
    return c.json({ system }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const system = await createSystem(body);
    return c.json({ system }, 201);
  })
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const system = await updateSystem(id, body);
    return c.json({ system }, 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deleteSystem(id);
    return c.json({ status: true }, 200);
  })
  .openapi(getServiceKeyRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getServiceKeyStatus(id), 200);
  })
  .openapi(rotateServiceKeyRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await rotateServiceKey(id), 201);
  })
  .openapi(revokeServiceKeyRoute, async (c) => {
    const { id } = c.req.valid("param");
    await revokeServiceKey(id);
    return c.json({ status: true }, 200);
  });
