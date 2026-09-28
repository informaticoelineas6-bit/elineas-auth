import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	AssignPermissionInput,
	MyPermission,
	SystemPermissions,
	UpdatePermissionInput,
} from "../shared/types.ts";

// Sin `systemSlug`, el IS resuelve los permisos en el sistema `auth` (ver
// GET /api/permissions/me). Este panel siempre pasa el suyo explícito, igual
// que listMyRoles, para no depender del valor por defecto del servidor.
export async function listMyPermissions(query: { systemSlug?: string } = {}) {
	const { permissions } = await isApi.get<{ permissions: MyPermission[] }>(
		`/api/permissions/me${buildQuery(query)}`,
	);
	return permissions;
}

// Catálogo agrupado por sistema, para la vista de administración de
// permisos (una card por sistema, badges por permiso).
export async function listPermissionsBySystem() {
	const { systems } = await isApi.get<{ systems: SystemPermissions[] }>(
		"/api/permissions/by-system",
	);
	return systems;
}

export async function assignPermission(input: AssignPermissionInput) {
	const { permission } = await isApi.post<{
		permission: { id: string; resource: string; action: string };
	}>("/api/permissions/assign", input);
	return permission;
}

export async function updatePermission(
	id: string,
	input: UpdatePermissionInput,
) {
	const { permission } = await isApi.patch<{
		permission: { id: string; resource: string; action: string };
	}>(`/api/permissions/${id}`, input);
	return permission;
}

export function removePermissionFromSystem(id: string, systemId: string) {
	return isApi.delete<{ deleted: boolean }>(
		`/api/permissions/${id}/systems/${systemId}`,
	);
}

// Toggle fino de un rol concreto (panel de edición): asigna o quita el
// permiso de UN rol sin tocar el resto de asignaciones ni el catálogo.
export function assignPermissionToRole(id: string, roleId: string) {
	return isApi.put<StatusResponse>(`/api/permissions/${id}/roles/${roleId}`);
}

export function unassignPermissionFromRole(id: string, roleId: string) {
	return isApi.delete<StatusResponse>(`/api/permissions/${id}/roles/${roleId}`);
}
