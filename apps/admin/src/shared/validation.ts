import z from "zod";

export const signInSchema = z.object({
	email: z.email("Correo electrónico inválido"),
	password: z
		.string()
		.min(12, "La contraseña debe tener 12 caracteres o más")
		.max(128, "La contraseña debe tener 12 caracteres o más"),
	rememberMe: z.boolean().optional(),
});
