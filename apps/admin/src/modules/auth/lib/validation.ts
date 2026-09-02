import { loginEmail, signInPassword } from "@elineas/auth-contracts";
import { z } from "zod";

// Token de confirmación del cambio de correo (llega en el enlace del email).
export const verifyEmailTokenSchema = z.object({
	token: z.string().min(1, "Falta el token de verificación"),
});

export const signInSchema = z.object({
	// `loginEmail` y `signInPassword`, no `companyEmailSchema`/`passwordSchema`:
	// al INICIAR SESIÓN no se valida ninguna política, solo que los campos
	// vengan. Antes este formulario exigía 12 caracteres de contraseña, la
	// política del ALTA, y eso dejaba fuera del panel a cualquier cuenta creada
	// antes de endurecerla: no podía entrar y, por tanto, tampoco cambiar su
	// contraseña. El servidor siempre fue permisivo aquí (`min(1)`); es el panel
	// el que iba por su cuenta. Ver `signInPassword` en @elineas/auth-contracts.
	email: loginEmail,
	password: signInPassword,
	rememberMe: z.boolean().optional(),
	// Token del captcha invisible (Cloudflare Turnstile). Opcional aquí: si el
	// captcha no está configurado en el servidor (TURNSTILE_SECRET_KEY), no se
	// exige. Si está configurado, signInFn lo valida y rechaza sin token.
	turnstileToken: z.string().optional(),
});
