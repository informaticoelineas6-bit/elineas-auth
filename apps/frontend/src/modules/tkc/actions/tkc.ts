import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { idSchema } from "#/modules/common/lib/validation.ts";
import { tkcCredentialsSchema } from "../lib/validation.ts";
import { getUserTkc, removeUserTkc, setUserTkc } from "../services/tkc.ts";

// El id del usuario viaja dentro del mismo payload que el cuerpo: una server
// function recibe un único `data`, así que no hay forma de pasarlo como
// parámetro de ruta aparte (mismo patrón que `adminChangeUserPasswordFn`).
const setTkcActionSchema = tkcCredentialsSchema.extend({
	userId: z.uuid("Identificador de usuario no válido"),
});

export const getUserTkcFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => getUserTkc(data.id));

export const setUserTkcFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(setTkcActionSchema)
	.handler(({ data }) => {
		const { userId, ...credentials } = data;
		return setUserTkc(userId, credentials);
	});

export const removeUserTkcFn = createServerFn({ method: "POST" })
	.middleware([requireAuthMiddleware])
	.validator(idSchema)
	.handler(({ data }) => removeUserTkc(data.id));
