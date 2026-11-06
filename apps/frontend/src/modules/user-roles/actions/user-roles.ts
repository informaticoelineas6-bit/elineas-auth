import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { fetchAllPages } from "#/modules/common/lib/paginate.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import {
	createUserRoleSchema,
	inviteUserSchema,
	myUserRolesQuerySchema,
	userDirectoryFiltersSchema,
	userRoleFiltersSchema,
} from "../lib/validation.ts";
import {
	createUserRole,
	deleteUserRole,
	getUserRole,
	inviteUser,
	listMyRoles,
	listUserDirectory,
	listUserRoles,
} from "../services/user-roles.ts";

export const listUserRolesFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(userRoleFiltersSchema)
	.handler(({ data }) => listUserRoles(data));

export const getUserRoleFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => getUserRole(data.id));

export const createUserRoleFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(createUserRoleSchema)
	.handler(({ data }) => createUserRole(data));

export const deleteUserRoleFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => deleteUserRole(data.id));

export const myUserRolesFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(myUserRolesQuerySchema)
	.handler(({ data }) => listMyRoles(data));

// Todas las asignaciones que cumplan los filtros (no solo la página visible),
// para exportar. El cliente arma el CSV/JSON/Excel con el array completo.
export const listAllUserRolesFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(userRoleFiltersSchema.omit({ page: true, limit: true }))
	.handler(({ data }) =>
		fetchAllPages(async (page, limit) => {
			const { userRoles, pagination } = await listUserRoles({
				...data,
				page,
				limit,
			});
			return { rows: userRoles, totalPages: pagination.totalPages };
		}),
	);

export const listUserDirectoryFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(userDirectoryFiltersSchema)
	.handler(({ data }) => listUserDirectory(data));

export const inviteUserFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(inviteUserSchema)
	.handler(({ data }) => inviteUser(data));
