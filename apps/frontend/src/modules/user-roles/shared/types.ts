import type { z } from "zod";
import type { Pagination } from "#/modules/common/shared/types.ts";
import type {
	createUserRoleSchema,
	inviteUserSchema,
	myUserRolesQuerySchema,
	userDirectoryFiltersSchema,
	userRoleFiltersSchema,
} from "../lib/validation.ts";

// Asignación de un rol a un usuario (vista de administración).
export type UserRole = {
	id: string;
	userId: string;
	roleId: string;
	createdAt: string;
};

// Asignación del listado de administración: el IS la devuelve con usuario, rol
// y sistema ya resueltos, así que se pueden mostrar aunque no estén en ningún
// otro listado cargado. `user` es null si la cuenta ya no existe.
export type UserRoleDetail = UserRole & {
	user: { name: string; email: string } | null;
	role: { name: string };
	system: { id: string; name: string; slug: string };
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
	userRoles: UserRoleDetail[];
	pagination: Pagination;
};

export type UserRoleFilters = z.input<typeof userRoleFiltersSchema>;
export type CreateUserRoleInput = z.infer<typeof createUserRoleSchema>;
export type MyUserRolesQuery = z.input<typeof myUserRolesQuerySchema>;

// Usuario del directorio (GET /api/users/admin/directory): solo lo necesario
// para elegir a quién asignar un rol.
export type DirectoryUser = {
	id: string;
	name: string;
	email: string;
	active: boolean;
	employeeName: string | null;
};

export type UserDirectoryResponse = {
	users: DirectoryUser[];
	pagination: Pagination;
};

export type UserDirectoryFilters = z.input<typeof userDirectoryFiltersSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
