import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros: paginación + filtro por sistema y búsqueda libre (nombre del rol).
export const roleFiltersSchema = paginationQuerySchema.extend({
	systemId: z.string().optional(),
	search: z.string().max(100).optional(),
});

export const createRoleSchema = z.object({
	systemId: z.string().min(1).max(100),
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

// El IS no permite cambiar el `systemId` de un rol existente: solo nombre y
// descripción.
export const updateRoleSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
});
