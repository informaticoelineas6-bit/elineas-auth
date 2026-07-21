import { readJson } from "#/modules/auth/lib/api.ts";
import { readSessionToken } from "#/modules/auth/lib/cookies.ts";
import { env } from "#/modules/auth/lib/env.ts";
import type { AuthApiSystem, AuthApiUser } from "../shared/types.ts";

export async function signIn(input: {
	email: string;
	password: string;
	systemSlug: string;
	rememberMe?: boolean;
}) {
	const response = await fetch(new URL("/api/auth/sign-in", env.AUTH_API_URL), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const body = (await readJson(response)) as {
		user: AuthApiUser;
		token: string | null;
		system: AuthApiSystem;
	};
	// El token de sesión (largo plazo, ver cookies.ts) viaja en esta cabecera,
	// no en el body: es lo que expone forwardAuthHeaders en la API para
	// consumidores que no son el propio navegador de better-auth.
	const sessionToken = response.headers.get("set-auth-token");
	return { ...body, sessionToken };
}

export async function signOut() {
	const sessionToken = readSessionToken();
	const response = await fetch(
		new URL("/api/auth/sign-out", env.AUTH_API_URL),
		{
			method: "POST",
			headers: { Authorization: `Bearer ${sessionToken}` },
		},
	);
	// Un 401 aquí solo significa que la sesión ya no era válida en el IS: da
	// igual, el resultado que queremos (quedar deslogueado) es el mismo.
	if (!response.ok && response.status !== 401) {
		await readJson(response);
	}
}

// Confirma el cambio de correo con el token del enlace. Endpoint público del IS
// (no requiere sesión): el token firmado es la credencial. readJson lanza
// AuthApiError si el token es inválido o caducó (401/400).
export async function verifyEmailChange(token: string) {
	const response = await fetch(
		new URL("/api/auth/verify-email", env.AUTH_API_URL),
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
		},
	);
	return (await readJson(response)) as { status: boolean };
}

// "Refresco" del JWT: el IS no tiene un refresh token separado, es este mismo
// token de sesión el que se cambia por un JWT nuevo de corta duración.
export async function refreshAccessToken(
	sessionToken: string,
): Promise<string | null> {
	const response = await fetch(new URL("/api/auth/token", env.AUTH_API_URL), {
		headers: { Authorization: `Bearer ${sessionToken}` },
	});
	if (!response.ok) return null;
	const body = (await response.json()) as { token: string | null };
	return body.token;
}
