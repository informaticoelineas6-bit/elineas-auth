import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { managedUserFiltersSchema } from "../lib/filters.ts";
import {
	resendInviteActionSchema,
	updateManagedUserActionSchema,
} from "../lib/validation.ts";
import {
	listManagedUsers,
	resendManagedUserInvite,
	updateManagedUser,
} from "../services/managed-users.ts";

export const listManagedUsersFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(managedUserFiltersSchema)
	.handler(({ data }) => listManagedUsers(data));

export const updateManagedUserFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(updateManagedUserActionSchema)
	.handler(({ data }) => updateManagedUser(data.id, data.body));

export const resendManagedUserInviteFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(resendInviteActionSchema)
	.handler(({ data }) => resendManagedUserInvite(data.id));
