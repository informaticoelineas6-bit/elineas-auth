import { z } from "zod";
import { passwordSchema } from "#/modules/common/lib/validation.ts";

export const updateProfileSchema = z.object({
	name: z
		.string()
		.min(1, "Debe tener al menos un caracter")
		.max(100, "Debe tener menos de 100 caracteres")
		.optional(),
	image: z.string().optional(),
});

// La nueva contraseña sigue la misma política que el alta (12-128). El cambio
// exige la contraseña actual (re-autenticación) en el IS.
export const changePasswordSchema = z.object({
	newPassword: passwordSchema,
	currentPassword: z.string().min(1, "Este campo es obligatorio"),
	revokeOtherSessions: z.boolean().optional(),
});

// El cambio de email también exige la contraseña actual: el IS lo aplica sin
// verificación por correo, así que es la única barrera ante una sesión robada.
export const changeEmailSchema = z.object({
	newEmail: z.email("Debe ser un correo electrónico válido"),
	currentPassword: z.string().min(1, "Este campo es obligatorio"),
	callbackURL: z.string().optional(),
});
