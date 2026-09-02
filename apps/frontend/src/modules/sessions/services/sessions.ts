import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	AdminSessionListResponse,
	SafeSession,
	SessionFilters,
} from "../shared/types.ts";

// Listado propio (no paginado): el IS devuelve el conjunto completo de sesiones
// activas del usuario autenticado.
export async function listSessions() {
	const { sessions } = await isApi.get<{ sessions: SafeSession[] }>(
		"/api/sessions",
	);
	return sessions;
}

// Sesión actual (la que respalda esta petición). Sirve para marcar cuál del
// listado es la propia; el listado no lo indica y el token nunca se expone.
export async function getCurrentSession() {
	const { session } = await isApi.get<{ session: SafeSession }>(
		"/api/sessions/session",
	);
	return session;
}

// Revoca TODAS las sesiones del usuario, incluida la actual (cierra la sesión).
export function revokeAllSessions() {
	return isApi.delete<StatusResponse>("/api/sessions");
}

// Revoca todas menos la actual (cerrar los demás dispositivos).
export function revokeOtherSessions() {
	return isApi.delete<StatusResponse>("/api/sessions/others");
}

// Listado administrativo: sesiones de TODOS los usuarios (no solo las
// propias). Requiere rol admin; el IS responde 403 si no lo tiene.
export function listAllSessions(filters: SessionFilters) {
	return isApi.get<AdminSessionListResponse>(
		`/api/sessions/admin${buildQuery(filters)}`,
	);
}

// Revoca por id la sesión de CUALQUIER usuario (el IS también expone un
// `/api/sessions/revoke` de autoservicio, pero solo permite revocar una
// sesión propia; esta consola siempre opera como admin).
export function adminRevokeSession(sessionId: string) {
	return isApi.delete<StatusResponse>("/api/sessions/admin/revoke", {
		sessionId,
	});
}
