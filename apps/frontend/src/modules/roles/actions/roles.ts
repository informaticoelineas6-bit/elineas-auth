import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
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
