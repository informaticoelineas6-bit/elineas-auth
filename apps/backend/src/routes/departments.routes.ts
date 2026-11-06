import { paginationMeta } from "@backend/lib/pagination.ts";
import { requirePermission } from "@backend/middleware/permission.ts";
import { requireSession } from "@backend/middleware/session.ts";
import {
  AddDepartmentMembersBodySchema,
  AddDepartmentMembersResultSchema,
  DepartmentMemberParamSchema,
  DepartmentMemberSchema,
  SetDepartmentMemberHeadBodySchema,
  BulkCreateDepartmentsBodySchema,
  BulkCreateDepartmentsResultSchema,
  CreateDepartmentBodySchema,
  DepartmentListItemSchema,
  DepartmentListQuerySchema,
  DepartmentSchema,
  IdParamSchema,
  PaginationSchema,
  UpdateDepartmentBodySchema,
} from "@backend/openapi/business.schemas.ts";
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
  addDepartmentMembers,
  listDepartmentMembers,
  removeDepartmentMember,
  setDepartmentMemberHead,
  bulkCreateDepartments,
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "@backend/services/department.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listDepartments",
  tags: ["Departments"],
  summary: "Listar departamentos (paginado, con nº de miembros)",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "read")] as const,
  request: { query: DepartmentListQuerySchema },
  responses: {
    200: {
      description: "Lista de departamentos",
      content: {
        "application/json": {
          schema: z.object({
            departments: z.array(DepartmentListItemSchema),
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
  operationId: "getDepartment",
  tags: ["Departments"],
  summary: "Obtener un departamento por id",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "read")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Departamento",
      content: {
        "application/json": { schema: z.object({ department: DepartmentSchema }) },
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
  operationId: "createDepartment",
  tags: ["Departments"],
  summary: "Crear un departamento",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "write")] as const,
  request: {
    body: { content: { "application/json": { schema: CreateDepartmentBodySchema } } },
  },
  responses: {
    201: {
      description: "Departamento creado",
      content: {
        "application/json": { schema: z.object({ department: DepartmentSchema }) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
});

const bulkRoute = createRoute({
  method: "post",
  path: "/bulk",
  operationId: "bulkCreateDepartments",
  tags: ["Departments"],
  summary: "Crear varios departamentos a la vez",
  description:
    "Los nombres repetidos o ya existentes se omiten y se devuelven en `skipped`.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "write")] as const,
  request: {
    body: {
      content: { "application/json": { schema: BulkCreateDepartmentsBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Resultado del alta múltiple",
      content: {
        "application/json": { schema: BulkCreateDepartmentsResultSchema },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/{id}",
  operationId: "updateDepartment",
  tags: ["Departments"],
  summary: "Actualizar un departamento",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "write")] as const,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateDepartmentBodySchema } } },
  },
  responses: {
    200: {
      description: "Departamento actualizado",
      content: {
        "application/json": { schema: z.object({ department: DepartmentSchema }) },
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
  operationId: "deleteDepartment",
  tags: ["Departments"],
  summary: "Eliminar un departamento",
  description: "Sus miembros quedan sin ese departamento.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "delete")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Departamento eliminado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const listMembersRoute = createRoute({
  method: "get",
  path: "/{id}/members",
  operationId: "listDepartmentMembers",
  tags: ["Departments"],
  summary: "Listar miembros de un departamento (jefes primero)",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "read")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Miembros",
      content: {
        "application/json": {
          schema: z.object({ members: z.array(DepartmentMemberSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const addMembersRoute = createRoute({
  method: "post",
  path: "/{id}/members",
  operationId: "addDepartmentMembers",
  tags: ["Departments"],
  summary: "Agregar varios usuarios a un departamento",
  description:
    "Quien no tenga ficha de empleado la recibe. Los que ya son miembros se omiten. `isHead` omitido: jefe solo si es admin.",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "write")] as const,
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: AddDepartmentMembersBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Resultado",
      content: { "application/json": { schema: AddDepartmentMembersResultSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const setHeadRoute = createRoute({
  method: "patch",
  path: "/{id}/members/{employeeId}",
  operationId: "setDepartmentMemberHead",
  tags: ["Departments"],
  summary: "Marcar o quitar a un miembro como jefe del departamento",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "write")] as const,
  request: {
    params: DepartmentMemberParamSchema,
    body: {
      content: { "application/json": { schema: SetDepartmentMemberHeadBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Actualizado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

const removeMemberRoute = createRoute({
  method: "delete",
  path: "/{id}/members/{employeeId}",
  operationId: "removeDepartmentMember",
  tags: ["Departments"],
  summary: "Quitar a una persona de un departamento",
  security: bearerAuthSecurity,
  middleware: [requireSession, requirePermission("departments", "write")] as const,
  request: { params: DepartmentMemberParamSchema },
  responses: {
    200: {
      description: "Quitado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// `/bulk` se declara antes que `/{id}` por claridad; al ser POST no choca con
// los GET/PATCH/DELETE de `/{id}`.
export const departmentsRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const { active, search, page, limit, sortBy, sortDir } = c.req.valid("query");
    const { rows, total } = await listDepartments(
      { active: active === undefined ? undefined : active === "true", search },
      { page, limit },
      { sortBy, sortDir },
    );
    return c.json(
      { departments: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(bulkRoute, async (c) => {
    return c.json(await bulkCreateDepartments(c.req.valid("json")), 201);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json({ department: await getDepartment(id) }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const department = await createDepartment(c.req.valid("json"));
    return c.json({ department }, 201);
  })
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const department = await updateDepartment(id, c.req.valid("json"));
    return c.json({ department }, 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deleteDepartment(id);
    return c.json({ status: true }, 200);
  })
  .openapi(listMembersRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json({ members: await listDepartmentMembers(id) }, 200);
  })
  .openapi(addMembersRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { userIds, isDepartmentHead } = c.req.valid("json");
    return c.json(await addDepartmentMembers(id, userIds, isDepartmentHead), 200);
  })
  .openapi(setHeadRoute, async (c) => {
    const { id, employeeId } = c.req.valid("param");
    await setDepartmentMemberHead(id, employeeId, c.req.valid("json").isHead);
    return c.json({ status: true }, 200);
  })
  .openapi(removeMemberRoute, async (c) => {
    const { id, employeeId } = c.req.valid("param");
    await removeDepartmentMember(id, employeeId);
    return c.json({ status: true }, 200);
  });
