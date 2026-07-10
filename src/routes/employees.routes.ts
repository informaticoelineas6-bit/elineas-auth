import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import { requireAdmin } from "@/middleware/admin";
import type { AppEnv } from "@/types/hono-env";
import {
  CreateEmployeeBodySchema,
  EmployeeListQuerySchema,
  EmployeeSchema,
  IdParamSchema,
  UpdateEmployeeBodySchema,
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
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "@/services/employee.service";

export const employeesRoutes = new OpenAPIHono<AppEnv>();

// Todo el recurso (lecturas y escrituras) requiere rol admin: los clientes
// normales solo pueden iniciar sesión, consultar el estado de su sesión y su
// propio usuario. requireAdmin se apoya en el user que puebla requireSession,
// por eso este último se registra primero.
employeesRoutes.use("*", requireSession);
employeesRoutes.use("*", requireAdmin);

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listEmployees",
  tags: ["Employees"],
  summary: "Listar empleados",
  security: bearerAuthSecurity,
  request: { query: EmployeeListQuerySchema },
  responses: {
    200: {
      description: "Lista de empleados",
      content: {
        "application/json": {
          schema: z.object({ employees: z.array(EmployeeSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

employeesRoutes.openapi(listRoute, async (c) => {
  const { active } = c.req.valid("query");
  const employees = await listEmployees({
    active: active === undefined ? undefined : active === "true",
  });
  return c.json({ employees }, 200);
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

employeesRoutes.openapi(getRoute, async (c) => {
  const { id } = c.req.valid("param");
  const employee = await getEmployee(id);
  return c.json({ employee }, 200);
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

employeesRoutes.openapi(createRouteDef, async (c) => {
  const body = c.req.valid("json");
  const employee = await createEmployee(body);
  return c.json({ employee }, 201);
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

employeesRoutes.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const employee = await updateEmployee(id, body);
  return c.json({ employee }, 200);
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

employeesRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  await deleteEmployee(id);
  return c.json({ status: true }, 200);
});
