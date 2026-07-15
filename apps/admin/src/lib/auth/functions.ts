import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AuthApiError, apiSignIn, apiSignOut } from "@/lib/auth/api";
import { env } from "@/lib/auth/env";
import {
	clearAuthCookies,
	readSessionToken,
	writeAccessToken,
	writeSessionToken,
} from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { authMiddleware } from "@/lib/auth/middleware";

const SignInSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
	rememberMe: z.boolean().optional(),
});

// Devuelve { error } en vez de lanzar para los fallos esperables (credenciales
// incorrectas, sin rol en el sistema, ...): así el formulario de login puede
// mostrar el mensaje sin tratar cada mutación como una excepción.
export const loginFn = createServerFn({ method: "POST" })
	.validator(SignInSchema)
	.handler(async ({ data }) => {
		try {
			const result = await apiSignIn({
				...data,
				systemSlug: env.AUTH_SYSTEM_SLUG,
			});
			if (!result.sessionToken) {
				throw new Error(
					"El servidor de autenticación no devolvió un token de sesión",
				);
			}

			writeSessionToken(result.sessionToken);
			if (result.token) {
				const payload = await verifyAccessToken(result.token);
				if (payload) writeAccessToken(result.token);
			}

			return { user: result.user } as const;
		} catch (error) {
			if (error instanceof AuthApiError) {
				return { error: error.message, code: error.code } as const;
			}
			throw error;
		}
	});

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
	const sessionToken = readSessionToken();
	if (sessionToken) {
		await apiSignOut(sessionToken).catch(() => {});
	}
	clearAuthCookies();
	return { success: true } as const;
});

export const getSessionFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => context.session);
