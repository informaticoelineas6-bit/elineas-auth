import type { z } from "zod";
import type { Pagination } from "#/modules/common/shared/types.ts";
import type {
	addMembersSchema,
	bulkCreateDepartmentsSchema,
	createDepartmentSchema,
	departmentFiltersSchema,
	updateDepartmentSchema,
} from "../lib/validation.ts";

export type Department = {
	id: string;
	name: string;
	description: string | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
};

// El listado añade el nº de miembros.
export type DepartmentListItem = Department & { memberCount: number };

export type DepartmentListResponse = {
	departments: DepartmentListItem[];
	pagination: Pagination;
};

export type DepartmentMember = {
	employeeId: string;
	userId: string | null;
	name: string;
	lastName: string;
	email: string | null;
	isHead: boolean;
};

// Departamento de una persona tal como lo devuelven los empleados.
export type EmployeeDepartment = { id: string; name: string; isHead: boolean };

// Elemento que se envía en `departments` al crear/editar una ficha.
export type EmployeeDepartmentInput = {
	departmentId: string;
	isHead?: boolean;
};

export type BulkCreateResult = { created: Department[]; skipped: string[] };
export type AddMembersResult = { added: string[]; skipped: string[] };

export type DepartmentFilters = z.input<typeof departmentFiltersSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type BulkCreateDepartmentsInput = z.infer<
	typeof bulkCreateDepartmentsSchema
>;
export type AddMembersInput = z.infer<typeof addMembersSchema>;
