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

// Exportar: el IS pagina (máx. 100 filas por página), pero exportar debe
// traer TODAS las filas que cumplan los filtros (no solo la página visible en
// la tabla). Recorre las páginas en el servidor y devuelve el array completo;
// el cliente arma el CSV/JSON/Excel a partir de él.
export const listAllEmployeesFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(employeeFiltersSchema.omit({ page: true, limit: true }))
	.handler(async ({ data }) => {
		const limit = 100;
		const all = [];
		for (let page = 1; ; page++) {
			const { employees, pagination } = await listEmployees({
				...data,
				page,
				limit,
			});
			all.push(...employees);
			if (employees.length === 0 || page >= pagination.totalPages) break;
		}
		return all;
	});
