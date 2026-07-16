import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros: paginación + búsqueda libre (nombre/slug) y estado activo.
export const systemFiltersSchema = paginationQuerySchema.extend({
	search: z.string().max(100).optional(),
	active: z.boolean().optional(),
});

export const createSystemSchema = z.object({
	name: z.string().min(1).max(100),
	// Mismo patrón que valida el IS: minúsculas, números y guiones.
	slug: z
		.string()
		.min(1)
		.max(50)
		.regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
	description: z.string().max(500).optional(),
	active: z.boolean().optional(),
});

export const updateSystemSchema = createSystemSchema.partial();
