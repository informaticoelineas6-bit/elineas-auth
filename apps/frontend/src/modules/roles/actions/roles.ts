import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { fetchAllPages } from "#/modules/common/lib/paginate.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import {
	createRoleSchema,
	roleFiltersSchema,
	updateRoleSchema,
} from "../lib/validation.ts";
import {
	createRole,
	deleteRole,
	getRole,
	listRoles,
	updateRole,
} from "../services/roles.ts";

export const listRolesFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(roleFiltersSchema)
	.handler(({ data }) => listRoles(data));

export const getRoleFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => getRole(data.id));

export const createRoleFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(createRoleSchema)
	.handler(({ data }) => createRole(data));

export const updateRoleFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema.extend({ body: updateRoleSchema }))
	.handler(({ data }) => updateRole(data.id, data.body));

export const deleteRoleFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => deleteRole(data.id));

// Todos los roles que cumplan los filtros (no solo la página visible), para
// exportar. El cliente arma el CSV/JSON/Excel a partir del array completo.
export const listAllRolesFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(roleFiltersSchema.omit({ page: true, limit: true }))
	.handler(({ data }) =>
		fetchAllPages(async (page, limit) => {
			const { roles, pagination } = await listRoles({ ...data, page, limit });
			return { rows: roles, totalPages: pagination.totalPages };
		}),
	);
