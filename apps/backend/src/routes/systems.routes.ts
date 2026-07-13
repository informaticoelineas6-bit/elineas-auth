import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  CreateSystemBodySchema,
  IdParamSchema,
  PaginationSchema,
  SystemListQuerySchema,
  SystemSchema,
  UpdateSystemBodySchema,
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
  createSystem,
  deleteSystem,
  getSystem,
  listSystems,
  updateSystem,
} from "@/services/system.service";

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listSystems",
  tags: ["Systems"],
  summary: "Listar sistemas (paginado, filtrable por estado y búsqueda)",
  security: bearerAuthSecurity,
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

// Todo el recurso requiere rol admin (lecturas incluidas). requireSession va
// primero porque requireAdmin usa el user que aquél puebla.
// El middleware se registra sobre la instancia base (no dentro de la cadena):
// OpenAPIHono.use() devuelve un `Hono` base sin `.openapi`, así que encadenarlo
// cortaría la inferencia de tipos del RPC. Registrado antes de las rutas, el
// orden de ejecución en runtime es el mismo (middleware primero).
const systemsRoutesBase = new OpenAPIHono<AppEnv>();
systemsRoutesBase.use("*", requireSession);
systemsRoutesBase.use("*", requireAdmin);

export const systemsRoutes = systemsRoutesBase
  .openapi(listRoute, async (c) => {
    const { active, search, page, limit } = c.req.valid("query");
    const { rows, total } = await listSystems(
      { active: active === undefined ? undefined : active === "true", search },
      { page, limit },
    );
    return c.json({ systems: rows, pagination: paginationMeta({ page, limit }, total) }, 200);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
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
  });
