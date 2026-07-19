import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros: paginación + filtro por sistema y búsqueda libre (nombre del rol).
export const roleFiltersSchema = paginationQuerySchema.extend({
	systemId: z.string().optional(),
	search: z.string().max(100, "Debe tener menos de 100 caracteres").optional(),
});

export const createRoleSchema = z.object({
	systemId: z
		.string()
		.min(1, "Debe tener al menos 1 caracter")
		.max(100, "Debe tener menos de 100 caracteres"),
	name: z
		.string()
		.min(1, "Debe tener al menos 1 caracter")
		.max(100, "Debe tener menos de 100 caracteres"),
	description: z
		.string()
		.max(500, "Debe tener menos de 500 caracteres")
		.optional(),
});

// El IS no permite cambiar el `systemId` de un rol existente: solo nombre y
// descripción.
export const updateRoleSchema = z.object({
	name: z
		.string()
		.min(1, "Debe tener al menos 1 caracter")
		.max(100, "Debe tener menos de 100 caracteres")
		.optional(),
	description: z
		.string()
		.max(500, "Debe tener menos de 500 caracteres")
		.optional(),
});

// Esquemas de formulario (solo cliente): mismos campos que el alta/edición pero
// con `description` siempre presente (arranca en "") para que el tipo del form
// case con el validador de TanStack Form. La descripción vacía se depura al
// construir el payload.
export const createRoleFormSchema = z.object({
	systemId: z
		.string()
		.min(1, "Selecciona un sistema")
		.max(100, "Debe tener menos de 100 caracteres"),
	name: createRoleSchema.shape.name,
	description: z.string().max(500, "Debe tener menos de 500 caracteres"),
});

// La edición no incluye `systemId` (el IS no permite cambiarlo).
export const editRoleFormSchema = createRoleFormSchema.omit({ systemId: true });
