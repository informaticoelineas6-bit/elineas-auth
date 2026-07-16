import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros de listado: paginación + búsqueda libre (nombre/apellido/CI) y estado.
// `active` se acepta como boolean y buildQuery lo serializa a "true"/"false",
// que es lo que el IS espera en la query string.
export const employeeFiltersSchema = paginationQuerySchema.extend({
	search: z.string().max(100).optional(),
	active: z.boolean().optional(),
});

// Cuerpo de alta. Las fechas viajan como string ISO; el IS las coacciona con
// z.coerce.date() en su extremo.
export const createEmployeeSchema = z.object({
	userId: z.string().max(100).optional(),
	name: z.string().min(1).max(100),
	lastName: z.string().min(1).max(100),
	ci: z.string().min(1).max(50),
	birthday: z.string().optional(),
	phoneNumber: z.string().max(30).optional(),
	address: z.string().max(300).optional(),
	inDate: z.string().optional(),
	outDate: z.string().optional(),
	active: z.boolean().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// Alta combinada usuario + empleado (POST /api/employees/with-user). El `userId`
// del empleado lo fija el servidor con el id del usuario recién creado, por eso
// se omite aquí.
export const createEmployeeWithUserSchema = z.object({
	user: z.object({
		name: z.string().min(1).max(100),
		email: z.email(),
		password: z.string().min(12).max(128),
		image: z.string().optional(),
	}),
	employee: createEmployeeSchema.omit({ userId: true }),
});
