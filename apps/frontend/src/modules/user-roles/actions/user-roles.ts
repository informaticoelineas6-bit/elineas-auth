import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import {
	createUserRoleSchema,
	myUserRolesQuerySchema,
	userRoleFiltersSchema,
} from "../lib/validation.ts";
import {
	createUserRole,
	deleteUserRole,
	getUserRole,
	listMyRoles,
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
