import { apiRefreshAccessToken } from "@/lib/auth/api";
import {
	clearAuthCookies,
	readAccessToken,
	readSessionToken,
	writeAccessToken,
} from "@/lib/auth/cookies";
import { type AccessTokenPayload, verifyAccessToken } from "@/lib/auth/jwt";

export type AuthSession = {
	userId: string;
	email?: string;
	name?: string;
	role?: string | null;
};

// Refresca el JWT un poco antes de que expire de verdad, para no arriesgarse a
// que caduque a mitad de la petición que lo está usando.
const REFRESH_SKEW_SECONDS = 30;

function toSession(payload: AccessTokenPayload): AuthSession {
	return {
		userId: payload.sub,
		email: payload.email,
		name: payload.name,
		role: payload.role,
	};
}

// Punto único de verdad para "¿quién es el usuario actual?": intenta validar
// el JWT ya cacheado en cookie (sin llamar al IS) y, si no está o expiró,
// lo refresca a partir del token de sesión de larga duración. Si tampoco ese
// token es válido, limpia las cookies y devuelve null (no autenticado).
export async function getAuthSession(): Promise<AuthSession | null> {
	const cachedToken = readAccessToken();
	if (cachedToken) {
		const payload = await verifyAccessToken(cachedToken);
		if (payload && payload.exp > nowSeconds() + REFRESH_SKEW_SECONDS) {
			return toSession(payload);
		}
	}

	const sessionToken = readSessionToken();
	if (!sessionToken) return null;

	const freshToken = await apiRefreshAccessToken(sessionToken);
	if (!freshToken) {
		clearAuthCookies();
		return null;
	}

	const payload = await verifyAccessToken(freshToken);
	if (!payload) {
		clearAuthCookies();
		return null;
	}

	writeAccessToken(freshToken);
	return toSession(payload);
}

function nowSeconds() {
	return Math.floor(Date.now() / 1000);
}
