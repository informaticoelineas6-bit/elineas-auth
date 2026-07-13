import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  CreateEmployeeBodySchema,
  EmployeeListQuerySchema,
  EmployeeSchema,
  IdParamSchema,
  PaginationSchema,
  UpdateEmployeeBodySchema,
} from "@/openapi/business.schemas";
import { paginationMeta } from "@/lib/pagination";
import {
  CreateEmployeeWithUserBodySchema,
  EmployeeWithUserResultSchema,
  StatusResponseSchema,
  badRequestResponse,
  bearerAuthSecurity,
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
} from "@/openapi/schemas";
import {
  createEmployee,
  createEmployeeWithUser,
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "@/services/employee.service";

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listEmployees",
  tags: ["Employees"],
  summary: "Listar empleados (paginado, filtrable por estado y búsqueda)",
  security: bearerAuthSecurity,
  request: { query: EmployeeListQuerySchema },
  responses: {
    200: {
      description: "Lista de empleados",
      content: {
        "application/json": {
          schema: z.object({
            employees: z.array(EmployeeSchema),
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
  operationId: "getEmployee",
  tags: ["Employees"],
  summary: "Obtener un empleado por id",
  security: bearerAuthSecurity,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Empleado",
      content: {
        "application/json": { schema: z.object({ employee: EmployeeSchema }) },
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
  operationId: "createEmployee",
  tags: ["Employees"],
  summary: "Crear un empleado",
  security: bearerAuthSecurity,
  request: {
    body: { content: { "application/json": { schema: CreateEmployeeBodySchema } } },
  },
  responses: {
    201: {
      description: "Empleado creado",
      content: {
        "application/json": { schema: z.object({ employee: EmployeeSchema }) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    409: conflictResponse,
  },
});

const createWithUserRoute = createRoute({
  method: "post",
  path: "/with-user",
  operationId: "createEmployeeWithUser",
  tags: ["Employees"],
  summary: "Crear un usuario y su empleado enlazado en una sola operación",
  security: bearerAuthSecurity,
  request: {
    body: {
      content: {
        "application/json": { schema: CreateEmployeeWithUserBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Usuario y empleado creados",
      content: {
        "application/json": { schema: EmployeeWithUserResultSchema },
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
  operationId: "updateEmployee",
  tags: ["Employees"],
  summary: "Actualizar un empleado",
  security: bearerAuthSecurity,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateEmployeeBodySchema } } },
  },
  responses: {
    200: {
      description: "Empleado actualizado",
      content: {
        "application/json": { schema: z.object({ employee: EmployeeSchema }) },
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
  operationId: "deleteEmployee",
  tags: ["Employees"],
  summary: "Eliminar un empleado",
  security: bearerAuthSecurity,
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Empleado eliminado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

// Todo el recurso (lecturas y escrituras) requiere rol admin: los clientes
// normales solo pueden iniciar sesión, consultar el estado de su sesión y su
// propio usuario. requireAdmin se apoya en el user que puebla requireSession,
// por eso este último se registra primero.
// El middleware se registra sobre la instancia base (no dentro de la cadena):
// OpenAPIHono.use() devuelve un `Hono` base sin `.openapi`, así que encadenarlo
// cortaría la inferencia de tipos del RPC. Registrado antes de las rutas, el
// orden de ejecución en runtime es el mismo (middleware primero).
const employeesRoutesBase = new OpenAPIHono<AppEnv>();
employeesRoutesBase.use("*", requireSession);
employeesRoutesBase.use("*", requireAdmin);

export const employeesRoutes = employeesRoutesBase
  .openapi(listRoute, async (c) => {
    const { active, search, page, limit } = c.req.valid("query");
    const { rows, total } = await listEmployees(
      { active: active === undefined ? undefined : active === "true", search },
      { page, limit },
    );
    return c.json(
      { employees: rows, pagination: paginationMeta({ page, limit }, total) },
      200,
    );
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const employee = await getEmployee(id);
    return c.json({ employee }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const employee = await createEmployee(body);
    return c.json({ employee }, 201);
  })
  .openapi(createWithUserRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await createEmployeeWithUser(body, c.req.raw.headers);
    return c.json(result, 201);
  })
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const employee = await updateEmployee(id, body);
    return c.json({ employee }, 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deleteEmployee(id);
    return c.json({ status: true }, 200);
  });
