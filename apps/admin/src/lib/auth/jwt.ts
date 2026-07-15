import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/auth/env";

export type AccessTokenPayload = {
	sub: string;
	email?: string;
	name?: string;
	image?: string | null;
	role?: string | null;
	exp: number;
	iat: number;
};

// createRemoteJWKSet cachea el JWKS en memoria y solo vuelve a pedirlo cuando
// aparece un `kid` desconocido (con cooldown), así que no hace falta una capa
// de caché propia encima de esta.
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", env.AUTH_API_URL));

// Verificación local y sin round-trip a la API: comprueba la firma contra el
// JWKS público y el `exp`. Devuelve null en vez de lanzar para que el llamador
// simplemente trate "inválido" y "expirado" igual (toca refrescar o
// desloguear), sin tener que distinguir el tipo de error de jose.
export async function verifyAccessToken(
	token: string,
): Promise<AccessTokenPayload | null> {
	try {
		const { payload } = await jwtVerify(token, jwks);
		if (!payload.sub) return null;
		return payload as AccessTokenPayload;
	} catch {
		return null;
	}
}
