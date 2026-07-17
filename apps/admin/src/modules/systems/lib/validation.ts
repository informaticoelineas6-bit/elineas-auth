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
