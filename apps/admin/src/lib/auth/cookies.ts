import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";

const SESSION_COOKIE = "es_session";
const ACCESS_TOKEN_COOKIE = "es_jwt";

const baseOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax",
	path: "/",
} as const;

// Debe cubrir, como mínimo, la duración de la sesión en el IS (7 días por
// defecto en better-auth) para que esta cookie no caduque antes que la sesión
// que representa.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function readSessionToken(): string | null {
	return getCookie(SESSION_COOKIE) ?? null;
}

export function writeSessionToken(token: string) {
	setCookie(SESSION_COOKIE, token, {
		...baseOptions,
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
}

export function readAccessToken(): string | null {
	return getCookie(ACCESS_TOKEN_COOKIE) ?? null;
}

// Sin maxAge propio: su vida útil real la marca el `exp` embebido en el JWT,
// que verifyAccessToken ya comprueba en cada lectura.
export function writeAccessToken(token: string) {
	setCookie(ACCESS_TOKEN_COOKIE, token, baseOptions);
}

export function clearAuthCookies() {
	deleteCookie(SESSION_COOKIE, baseOptions);
	deleteCookie(ACCESS_TOKEN_COOKIE, baseOptions);
}
