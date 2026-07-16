import { isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type { SafeSession } from "../shared/types.ts";

// Listado propio (no paginado): el IS devuelve el conjunto completo de sesiones
// activas del usuario autenticado.
export async function listSessions() {
	const { sessions } = await isApi.get<{ sessions: SafeSession[] }>(
		"/api/sessions",
	);
	return sessions;
}

// Revoca TODAS las sesiones del usuario, incluida la actual (cierra la sesión).
export function revokeAllSessions() {
	return isApi.delete<StatusResponse>("/api/sessions");
}

// Revoca todas menos la actual (cerrar los demás dispositivos).
export function revokeOtherSessions() {
	return isApi.delete<StatusResponse>("/api/sessions/others");
}

export function revokeSession(sessionId: string) {
	return isApi.delete<StatusResponse>("/api/sessions/revoke", { sessionId });
}
