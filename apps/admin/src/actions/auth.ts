import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/middlewares/auth.ts";
import { signIn, signOut } from "#/services/auth.ts";
import { signInSchema } from "#/shared/validation.ts";
import { AuthApiError } from "@/lib/auth/api";
import {
	clearAuthCookies,
	readSessionToken,
	writeAccessToken,
	writeSessionToken,
} from "@/lib/auth/cookies";
import { env } from "@/lib/auth/env";
import { verifyAccessToken } from "@/lib/auth/jwt";

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
				return { error: error.message, code: error.code } as const;
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
