import type { z } from "zod";
import type { Pagination } from "#/modules/common/shared/types.ts";
import type {
	createUserRoleSchema,
	myUserRolesQuerySchema,
	userRoleFiltersSchema,
} from "../lib/validation.ts";

// Asignación de un rol a un usuario (vista de administración).
export type UserRole = {
	id: string;
	userId: string;
	roleId: string;
	createdAt: string;
};

// Rol propio del usuario autenticado: incluye el sistema al que pertenece para
// poder filtrar por `systemSlug` sin exponer asignaciones de otros usuarios.
export type MyUserRole = {
	id: string;
	name: string;
	description: string | null;
	system: {
		id: string;
		slug: string;
		name: string;
	};
};

export type UserRoleListResponse = {
	userRoles: UserRole[];
	pagination: Pagination;
};

export type UserRoleFilters = z.input<typeof userRoleFiltersSchema>;
export type CreateUserRoleInput = z.infer<typeof createUserRoleSchema>;
export type MyUserRolesQuery = z.input<typeof myUserRolesQuerySchema>;
