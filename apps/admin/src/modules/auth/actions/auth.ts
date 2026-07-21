import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthApiError } from "#/modules/auth/lib/api.ts";
import {
	clearAccessToken,
	clearAuthCookies,
	readSessionToken,
	writeAccessToken,
	writeSessionToken,
} from "#/modules/auth/lib/cookies.ts";
import { env } from "#/modules/auth/lib/env.ts";
import { verifyAccessToken } from "#/modules/auth/lib/jwt.ts";
import { verifyTurnstileToken } from "#/modules/auth/lib/turnstile-server.ts";
import { signInSchema, verifyEmailTokenSchema } from "../lib/validation.ts";
import { authMiddleware } from "../middlewares/auth.ts";
import { signIn, signOut, verifyEmailChange } from "../services/auth.ts";

// Site key pública para el widget del cliente. `TURNSTILE_SECRET_KEY` (server-
// only) nunca sale de aquí: se usa solo dentro de signInFn.
export const getTurnstileSiteKeyFn = createServerFn({ method: "GET" }).handler(
	() => env.TURNSTILE_SITE_KEY ?? null,
);

export const signInFn = createServerFn({ method: "POST" })
	.validator(signInSchema)
	.handler(async ({ data }) => {
		try {
			const { turnstileToken, ...credentials } = data;

			if (env.TURNSTILE_SECRET_KEY) {
				const valid = await verifyTurnstileToken(
					turnstileToken,
					env.TURNSTILE_SECRET_KEY,
				);
				if (!valid) {
					return {
						error: "No se pudo verificar que no eres un robot. Intenta de nuevo.",
						code: "CAPTCHA_FAILED",
						status: 403,
					} as const;
				}
			}

			const result = await signIn({
				...credentials,
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
				// Se devuelve retryAfter para que el login muestre la cuenta atrás real
				// del 429 (rate limit) en vez de un mensaje genérico.
				return {
					error: error.message,
					code: error.code,
					status: error.status,
					retryAfter: error.retryAfter,
				} as const;
			}
			throw error;
		}
	});

export const signOutFn = createServerFn({ method: "POST" }).handler(
	async () => {
		const sessionToken = readSessionToken();
		if (sessionToken) {
			await signOut().catch(() => {});
		}
		clearAuthCookies();
		redirect({
			to: "/",
		});
		return { success: true } as const;
	},
);

export const getSessionFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => context.session);

// Confirma el cambio de correo. Público a propósito (sin authMiddleware): el
// usuario abre el enlace desde su correo y puede no tener sesión en el frontend.
// Devuelve un resultado tipado en vez de lanzar, para que la página /verify-email
// muestre éxito o error sin un error boundary.
export const verifyEmailChangeFn = createServerFn({ method: "POST" })
	.validator(verifyEmailTokenSchema)
	.handler(async ({ data }) => {
		try {
			await verifyEmailChange(data.token);
			// Si quien confirma el enlace es el mismo navegador que ya tenía sesión,
			// su JWT cacheado sigue con el email viejo (ver session.ts). Se descarta
			// para forzar el refresh contra el IS en la próxima petición.
			clearAccessToken();
			return { ok: true } as const;
		} catch (error) {
			if (error instanceof AuthApiError) {
				return {
					ok: false,
					error: error.message,
					code: error.code,
					status: error.status,
				} as const;
			}
			throw error;
		}
	});
