import { createServerFn } from "@tanstack/react-start";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import {
	changeEmailSchema,
	changePasswordSchema,
	updateProfileSchema,
} from "../lib/validation.ts";
import {
	changeEmail,
	changePassword,
	getMe,
	updateMe,
} from "../services/users.ts";

export const getMeFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.handler(() => getMe());

export const updateMeFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(updateProfileSchema)
	.handler(({ data }) => updateMe(data));

export const changePasswordFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(changePasswordSchema)
	.handler(({ data }) => changePassword(data));

export const changeEmailFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(changeEmailSchema)
	.handler(({ data }) => changeEmail(data));
