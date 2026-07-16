import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros del listado administrativo: paginación + filtro por usuario o rol.
export const userRoleFiltersSchema = paginationQuerySchema.extend({
	userId: z.string().optional(),
	roleId: z.string().optional(),
});

export const createUserRoleSchema = z.object({
	userId: z.string().min(1).max(100),
	roleId: z.string().min(1).max(100),
});

// Roles propios del usuario autenticado (no requiere admin), opcionalmente
// acotados a un sistema por su slug.
export const myUserRolesQuerySchema = z.object({
	systemSlug: z.string().optional(),
});
