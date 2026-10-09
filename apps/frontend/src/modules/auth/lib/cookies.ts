import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";

const SESSION_COOKIE = "is_session";
const ACCESS_TOKEN_COOKIE = "is_jwt";

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

// Descarta solo el JWT cacheado (no la sesión de largo plazo): fuerza a que la
// próxima getAuthSession() lo refresque contra el IS en vez de seguir sirviendo
// claims viejos (p. ej. el email) hasta que el JWT expire por su cuenta.
export function clearAccessToken() {
	deleteCookie(ACCESS_TOKEN_COOKIE, baseOptions);
}

// Estado del login con Google entre la salida hacia el IS y la vuelta: el
// `verifier` PKCE y el `state` anti-CSRF. httpOnly y de vida corta; `lax` para
// que viaje en la navegación de vuelta desde el IS (GET de nivel superior).
const GOOGLE_FLOW_COOKIE = "is_google_flow";

export function writeGoogleFlow(flow: { verifier: string; state: string }) {
	setCookie(GOOGLE_FLOW_COOKIE, JSON.stringify(flow), {
		...baseOptions,
		maxAge: 10 * 60,
	});
}

export function readGoogleFlow(): { verifier: string; state: string } | null {
	const raw = getCookie(GOOGLE_FLOW_COOKIE);
	if (!raw) return null;
	try {
		const flow = JSON.parse(raw) as { verifier?: unknown; state?: unknown };
		return typeof flow.verifier === "string" && typeof flow.state === "string"
			? { verifier: flow.verifier, state: flow.state }
			: null;
	} catch {
		return null;
	}
}

export function clearGoogleFlow() {
	deleteCookie(GOOGLE_FLOW_COOKIE, baseOptions);
}
