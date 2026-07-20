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
		// La primera página revela `totalPages`; las páginas 2..N son
		// independientes entre sí, así que se piden en paralelo en vez de una tras
		// otra (antes O(N) round-trips en serie). La concurrencia se acota porque
		// el IS tiene rate-limiting: una ráfaga sin límite dispararía 429.
		const first = await listEmployees({ ...data, page: 1, limit });
		const all = [...first.employees];
		const totalPages = first.pagination.totalPages;
		if (totalPages <= 1) return all;

		const CONCURRENCY = 5;
		const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
		for (let i = 0; i < pages.length; i += CONCURRENCY) {
			const chunk = pages.slice(i, i + CONCURRENCY);
			const results = await Promise.all(
				chunk.map((page) => listEmployees({ ...data, page, limit })),
			);
			// El orden del chunk se preserva (Promise.all mantiene el orden de
			// entrada), así que el array final queda ordenado por página.
			for (const { employees } of results) all.push(...employees);
		}
		return all;
	});
