import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { MyPermission } from "../shared/types.ts";

// Sin `systemSlug`, el IS resuelve los permisos en el sistema `auth` (ver
// GET /api/permissions/me). Este panel siempre pasa el suyo explícito, igual
// que listMyRoles, para no depender del valor por defecto del servidor.
export async function listMyPermissions(query: { systemSlug?: string } = {}) {
	const { permissions } = await isApi.get<{ permissions: MyPermission[] }>(
		`/api/permissions/me${buildQuery(query)}`,
	);
	return permissions;
}
