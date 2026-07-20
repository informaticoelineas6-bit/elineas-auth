import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthApiError } from "#/modules/auth/lib/api.ts";
import {
	clearAuthCookies,
	readSessionToken,
	writeAccessToken,
	writeSessionToken,
} from "#/modules/auth/lib/cookies.ts";
import { env } from "#/modules/auth/lib/env.ts";
import { verifyAccessToken } from "#/modules/auth/lib/jwt.ts";
import { signInSchema } from "../lib/validation.ts";
import { authMiddleware } from "../middlewares/auth.ts";
import { signIn, signOut } from "../services/auth.ts";

export const signInFn = createServerFn({ method: "POST" })
	.validator(signInSchema)
	.handler(async ({ data }) => {
		try {
			const result = await signIn({
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
