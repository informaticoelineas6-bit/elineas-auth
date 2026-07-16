import { z } from "zod";

export const updateProfileSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	image: z.string().optional(),
});

// La nueva contraseña sigue la misma política que el alta (12-128). El cambio
// exige la contraseña actual (re-autenticación) en el IS.
export const changePasswordSchema = z.object({
	newPassword: z.string().min(12).max(128),
	currentPassword: z.string().min(1),
	revokeOtherSessions: z.boolean().optional(),
});

// El cambio de email también exige la contraseña actual: el IS lo aplica sin
// verificación por correo, así que es la única barrera ante una sesión robada.
export const changeEmailSchema = z.object({
	newEmail: z.email(),
	currentPassword: z.string().min(1),
	callbackURL: z.string().optional(),
});
