import { z } from "zod";

// Token de confirmación del cambio de correo (llega en el enlace del email).
export const verifyEmailTokenSchema = z.object({
	token: z.string().min(1, "Falta el token de verificación"),
});

export const signInSchema = z.object({
	email: z.email("Correo electrónico inválido"),
	password: z
		.string()
		.min(12, "La contraseña debe tener 12 caracteres o más")
		.max(128, "La contraseña debe tener 12 caracteres o más"),
	rememberMe: z.boolean().optional(),
	// Token del captcha invisible (Cloudflare Turnstile). Opcional aquí: si el
	// captcha no está configurado en el servidor (TURNSTILE_SECRET_KEY), no se
	// exige. Si está configurado, signInFn lo valida y rechaza sin token.
	turnstileToken: z.string().optional(),
});
