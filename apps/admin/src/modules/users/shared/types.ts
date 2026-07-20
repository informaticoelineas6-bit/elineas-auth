import type { z } from "zod";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	changeEmailSchema,
	changePasswordFormSchema,
	changePasswordSchema,
	updateProfileSchema,
} from "../lib/validation.ts";

// Usuario del IS (esquema `User` de su OpenAPI). Las fechas llegan como string
// ISO en JSON. Es el tipo canónico de usuario reutilizado por otros módulos
// (p. ej. el alta combinada de empleados).
export type User = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: string;
	updatedAt: string;
	role?: string | null;
	banned?: boolean | null;
	banReason?: string | null;
	banExpires?: string | null;
};

// El IS emite un JWT nuevo tras cambiar la contraseña (las sesiones se mantienen
// salvo que se pida revocarlas). El token no se persiste en el frontend: la
// server function ya opera con la cookie de sesión.
export type ChangePasswordResult = {
	token?: string | null;
	user: User;
};

export type ChangeEmailResult = {
	user?: User;
	status: boolean;
};

export type UpdateProfileResult = StatusResponse;

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
