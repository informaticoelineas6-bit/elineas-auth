import { z } from "zod";
import { phoneSchema } from "#/modules/common/lib/phone.ts";
import {
	companyEmailSchema,
	idSchema,
} from "#/modules/common/lib/validation.ts";

const name = z
	.string()
	.min(1, "Debe tener al menos 1 caracter")
	.max(100, "Debe tener menos de 100 caracteres");

// Ficha de empleado editable (todo opcional; solo viaja lo que cambia). `ci` y
// el teléfono se omiten cuando están vacíos, como en el formulario de empleados.
export const managedEmployeeSchema = z.object({
	name: name.optional(),
	lastName: name.optional(),
	ci: z.string().length(11, "El CI debe tener 11 dígitos").optional(),
	phoneNumber: phoneSchema.optional(),
	address: z.string().max(300, "Debe tener menos de 300 caracteres").optional(),
	active: z.boolean().optional(),
});

export const updateManagedUserSchema = z.object({
	name: name.optional(),
	email: companyEmailSchema.optional(),
	employee: managedEmployeeSchema.optional(),
});

export const updateManagedUserActionSchema = idSchema.extend({
	body: updateManagedUserSchema,
});

export const resendInviteActionSchema = idSchema;
