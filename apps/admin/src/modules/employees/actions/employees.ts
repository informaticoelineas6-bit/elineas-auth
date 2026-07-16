import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import {
	createEmployeeSchema,
	createEmployeeWithUserSchema,
	employeeFiltersSchema,
	updateEmployeeSchema,
} from "../lib/validation.ts";
import {
	createEmployee,
	createEmployeeWithUser,
	deleteEmployee,
	getEmployee,
	listEmployees,
	updateEmployee,
} from "../services/employees.ts";

export const listEmployeesFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(employeeFiltersSchema)
	.handler(({ data }) => listEmployees(data));

export const getEmployeeFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => getEmployee(data.id));

export const createEmployeeFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(createEmployeeSchema)
	.handler(({ data }) => createEmployee(data));

export const createEmployeeWithUserFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(createEmployeeWithUserSchema)
	.handler(({ data }) => createEmployeeWithUser(data));

export const updateEmployeeFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ body: updateEmployeeSchema }))
	.handler(({ data }) => updateEmployee(data.id, data.body));

export const deleteEmployeeFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => deleteEmployee(data.id));
