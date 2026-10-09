import { createHash, randomBytes } from "node:crypto";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AuthApiError } from "#/modules/auth/lib/api.ts";
import {
	clearAccessToken,
	clearAuthCookies,
	clearGoogleFlow,
	readGoogleFlow,
	readSessionToken,
	writeAccessToken,
	writeGoogleFlow,
	writeSessionToken,
} from "#/modules/auth/lib/cookies.ts";
import { env } from "#/modules/auth/lib/env.ts";
import { verifyAccessToken } from "#/modules/auth/lib/jwt.ts";
import { verifyTurnstileToken } from "#/modules/auth/lib/turnstile-server.ts";
import {
	setPasswordSchema,
	signInSchema,
	verifyEmailTokenSchema,
} from "../lib/validation.ts";
import { authMiddleware } from "../middlewares/auth.ts";
import {
	exchangeGoogleCode,
	setPassword,
	signIn,
	signOut,
	verifyEmailChange,
} from "../services/auth.ts";

// Site key pública para el widget del cliente. `TURNSTILE_SECRET_KEY` (server-
// only) nunca sale de aquí: se usa solo dentro de signInFn.
export const getTurnstileSiteKeyFn = createServerFn({ method: "GET" }).handler(
	() => env.TURNSTILE_SITE_KEY ?? null,
);

// El botón de Google solo se muestra si hay APP_PUBLIC_URL (ver lib/env.ts).
export const getGoogleEnabledFn = createServerFn({ method: "GET" }).handler(
	() => Boolean(env.APP_PUBLIC_URL),
);

// Primer paso del login con Google: genera el PKCE y el state, los guarda en una
// cookie httpOnly y devuelve la URL del IS a la que debe ir el navegador.
export const startGoogleLoginFn = createServerFn({ method: "POST" }).handler(
	async () => {
		if (!env.APP_PUBLIC_URL) {
			return { error: "El inicio de sesión con Google no está disponible." } as const;
		}
		const verifier = randomBytes(32).toString("base64url");
		const state = randomBytes(16).toString("hex");
		writeGoogleFlow({ verifier, state });
		const url = new URL("/api/auth/google/start", env.AUTH_PUBLIC_URL);
		url.searchParams.set(
			"redirect_to",
			new URL("/auth/google/callback", env.APP_PUBLIC_URL).toString(),
		);
		url.searchParams.set(
			"code_challenge",
			createHash("sha256").update(verifier).digest("base64url"),
		);
		url.searchParams.set("state", state);
		url.searchParams.set("systemSlug", env.AUTH_SYSTEM_SLUG);
		return { url: url.toString() } as const;
	},
);

const GOOGLE_ERRORS: Record<string, string> = {
	ACCOUNT_NOT_FOUND:
		"No existe una cuenta con ese correo de Google. Pide a un administrador que la cree.",
	NO_ROLES_IN_SYSTEM: "Tu cuenta no tiene acceso a este sistema.",
	GOOGLE_ACCESS_DENIED: "Cancelaste el inicio de sesión con Google.",
};

// Último paso: el IS devolvió al usuario a /auth/google/callback con un código
// (o un error). Se comprueba el state, se canjea el código con el verifier y se
// abre la sesión igual que en signInFn. Devuelve un resultado tipado.
export const completeGoogleLoginFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			code: z.string().optional(),
			state: z.string().optional(),
			error: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const flow = readGoogleFlow();
		// De un solo uso: se descarta pase lo que pase.
		clearGoogleFlow();
		if (data.error) {
			return {
				ok: false,
				error:
					GOOGLE_ERRORS[data.error] ??
					"No se pudo iniciar sesión con Google. Intenta nuevamente.",
			} as const;
		}
		if (!flow || !data.code || !data.state || data.state !== flow.state) {
			return {
				ok: false,
				error: "La sesión de Google no es válida o caducó. Intenta nuevamente.",
			} as const;
		}
		try {
			const result = await exchangeGoogleCode(data.code, flow.verifier);
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
			return { ok: true } as const;
		} catch (error) {
			if (error instanceof AuthApiError) {
				return { ok: false, error: error.message } as const;
			}
			throw error;
		}
	});

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

// Establece la contraseña de una cuenta invitada. Server fn PÚBLICA (la persona
// aún no tiene contraseña ni sesión). Devuelve un resultado tipado en vez de
// lanzar, igual que verifyEmailChangeFn.
export const setPasswordFn = createServerFn({ method: "POST" })
	.validator(setPasswordSchema)
	.handler(async ({ data }) => {
		try {
			await setPassword(data.token, data.newPassword);
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
