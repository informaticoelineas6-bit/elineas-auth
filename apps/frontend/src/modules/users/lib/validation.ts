import { currentPassword } from "@elineas/auth-contracts";
import { z } from "zod";
import {
	companyEmailSchema,
	passwordSchema,
} from "#/modules/common/lib/validation.ts";

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
	currentPassword,
	revokeOtherSessions: z.boolean().optional(),
});

// Esquema del formulario de cambio de contraseña (solo cliente): añade la
// confirmación (no se envía al IS) y fija `revokeOtherSessions` como booleano
// siempre presente para que el tipo del form case con el validador.
export const changePasswordFormSchema = z
	.object({
		currentPassword,
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
	newEmail: companyEmailSchema,
	currentPassword,
	callbackURL: z.string().optional(),
});

// --- Cambio de contraseña de OTRO usuario (acción de admin) -----------------
//
// Es una operación distinta del cambio propio, no una variante: el admin no
// conoce la contraseña del usuario, así que la re-autenticación se hace con la
// contraseña DEL ADMIN. Espeja AdminChangePasswordBodySchema del servidor.
export const adminChangePasswordSchema = z.object({
	newPassword: passwordSchema,
	// La del admin que ejecuta la acción.
	currentPassword,
	revokeSessions: z.boolean().optional(),
});

// Esquema del formulario (solo cliente): añade la confirmación —que no se envía
// al IS— y fija `revokeSessions` como booleano siempre presente para que el
// tipo del form case con el validador.
export const adminChangePasswordFormSchema = z
	.object({
		currentPassword,
		newPassword: passwordSchema,
		confirmNewPassword: z.string().min(1, "Confirma la nueva contraseña"),
		revokeSessions: z.boolean(),
	})
	.refine((value) => value.newPassword === value.confirmNewPassword, {
		message: "Las contraseñas no coinciden",
		path: ["confirmNewPassword"],
	});
