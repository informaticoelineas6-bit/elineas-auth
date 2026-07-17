import type { z } from "zod";
import type { Pagination } from "#/modules/common/shared/types.ts";
import type { User } from "#/modules/users/shared/types.ts";
import type {
	createEmployeeSchema,
	createEmployeeWithUserFormSchema,
	createEmployeeWithUserSchema,
	employeeFiltersSchema,
	updateEmployeeSchema,
} from "../lib/validation.ts";

// Las fechas del IS se serializan a string ISO en JSON, así que llegan como
// string (o null) al frontend, nunca como Date.
export type Employee = {
	id: string;
	userId: string | null;
	name: string;
	lastName: string;
	ci: string;
	birthday: string | null;
	phoneNumber: string | null;
	address: string | null;
	inDate: string | null;
	outDate: string | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
	// Cuenta de usuario enlazada. El listado (GET /api/employees) la embebe para
	// ver/filtrar por email en una sola vista; las respuestas de un empleado
	// individual la omiten. `null` si el empleado no tiene usuario.
	user?: EmployeeUser | null;
};

export type EmployeeUser = {
	id: string;
	name: string;
	email: string;
};

export type EmployeeListResponse = {
	employees: Employee[];
	pagination: Pagination;
};

export type EmployeeWithUserResult = {
	user: User;
	employee: Employee;
};

export type EmployeeFilters = z.input<typeof employeeFiltersSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateEmployeeWithUserInput = z.infer<
	typeof createEmployeeWithUserSchema
>;
export type CreateEmployeeWithUserFormInput = z.infer<
	typeof createEmployeeWithUserFormSchema
>;
