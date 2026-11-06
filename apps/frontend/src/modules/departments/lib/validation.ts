import { SORT_FIELDS, sortQuery } from "@elineas/auth-contracts";
import { z } from "zod";
import { listSearchSchema } from "#/modules/common/lib/validation.ts";

export const departmentFiltersSchema = listSearchSchema.extend({
	active: z.boolean().optional(),
	...sortQuery(SORT_FIELDS.departments),
});

export const createDepartmentSchema = z.object({
	name: z
		.string()
		.min(1, "Debe tener al menos un caracter")
		.max(100, "Debe tener menos de 100 caracteres"),
	description: z
		.string()
		.max(500, "Debe tener menos de 500 caracteres")
		.optional(),
	active: z.boolean().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

// Esquema del formulario: description/active siempre presentes.
export const departmentFormSchema = z.object({
	name: createDepartmentSchema.shape.name,
	description: z.string().max(500, "Debe tener menos de 500 caracteres"),
	active: z.boolean(),
});

export const bulkCreateDepartmentsSchema = z.object({
	departments: z.array(createDepartmentSchema).min(1).max(100),
});

export const addMembersSchema = z.object({
	userIds: z.array(z.uuid()).min(1).max(200),
	isDepartmentHead: z.boolean().optional(),
});

export const memberHeadSchema = z.object({
	id: z.uuid(),
	employeeId: z.uuid(),
	isHead: z.boolean(),
});

export const memberRefSchema = z.object({
	id: z.uuid(),
	employeeId: z.uuid(),
});
