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

// Esquema del formulario de perfil (solo cliente): name/image siempre presentes
// (arrancan con valor), para que el tipo del form case con el validador.
export const profileFormSchema = z.object({
	name: z
		.string()
		.min(1, "Debe tener al menos un caracter")
		.max(100, "Debe tener menos de 100 caracteres"),
	image: z.string(),
});

// La nueva contraseña sigue la misma política que el alta (12-128). El cambio
// exige la contraseña actual (re-autenticación) en el IS.
export const changePasswordSchema = z.object({
	newPassword: passwordSchema,
	currentPassword: z.string().min(1, "Este campo es obligatorio"),
	revokeOtherSessions: z.boolean().optional(),
});

// Esquema del formulario de cambio de contraseña (solo cliente): añade la
// confirmación (no se envía al IS) y fija `revokeOtherSessions` como booleano
// siempre presente para que el tipo del form case con el validador.
export const changePasswordFormSchema = z
	.object({
		currentPassword: z.string().min(1, "Este campo es obligatorio"),
		newPassword: passwordSchema,
		confirmNewPassword: z.string().min(1, "Confirma la nueva contraseña"),
		revokeOtherSessions: z.boolean(),
	})
	.refine((value) => value.newPassword === value.confirmNewPassword, {
		message: "Las contraseñas no coinciden",
		path: ["confirmNewPassword"],
	});

// El cambio de email también exige la contraseña actual: el IS lo aplica sin
// verificación por correo, así que es la única barrera ante una sesión robada.
export const changeEmailSchema = z.object({
	newEmail: z.email("Debe ser un correo electrónico válido"),
	currentPassword: z.string().min(1, "Este campo es obligatorio"),
	callbackURL: z.string().optional(),
});
