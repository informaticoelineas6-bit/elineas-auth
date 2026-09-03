import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import {
	adminChangePasswordSchema,
	changeEmailSchema,
	changePasswordSchema,
	updateProfileSchema,
} from "../lib/validation.ts";
import {
	adminChangeUserPassword,
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

// El id del usuario objetivo viaja en el mismo payload que el resto del cuerpo:
// una server function recibe un único `data`, así que no hay forma de pasarlo
// como parámetro de ruta aparte. Se separa del cuerpo antes de llamar al IS.
const adminChangePasswordActionSchema = adminChangePasswordSchema.extend({
	userId: z.uuid("Identificador de usuario no válido"),
});

export const adminChangeUserPasswordFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(adminChangePasswordActionSchema)
	.handler(({ data }) => {
		const { userId, ...body } = data;
		return adminChangeUserPassword(userId, body);
	});
