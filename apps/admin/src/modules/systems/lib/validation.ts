import { z } from "zod";
import { listSearchSchema } from "#/modules/common/lib/validation.ts";

// Filtros: paginación + búsqueda libre (nombre/slug) y estado activo.
export const systemFiltersSchema = listSearchSchema.extend({
	active: z.boolean().optional(),
});

export const createSystemSchema = z.object({
	name: z
		.string()
		.min(1, "Debe tener al menos un caracter")
		.max(100, "Debe tener menos de 100 caracteres"),
	// Mismo patrón que valida el IS: minúsculas, números y guiones.
	slug: z
		.string()
		.min(1, "Debe tener al menos un caracter")
		.max(50, "Debe tener menos de 50 caracteres")
		.regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
	description: z
		.string()
		.max(500, "Debe tener menos de 500 caracteres")
		.optional(),
	active: z.boolean().optional(),
});

export const updateSystemSchema = createSystemSchema.partial();

// Esquema del formulario (solo cliente): mismos campos que el alta pero con
// `description` y `active` siempre presentes (el form arranca con "" y un
// booleano), para que el tipo del form case con lo que espera el validador de
// TanStack Form. La depuración de la descripción vacía se hace al construir el
// payload, no aquí.
export const systemFormSchema = z.object({
	name: createSystemSchema.shape.name,
	slug: createSystemSchema.shape.slug,
	description: z.string().max(500, "Debe tener menos de 500 caracteres"),
	active: z.boolean(),
});
