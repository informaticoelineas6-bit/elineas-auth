import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	CreateRoleInput,
	Role,
	RoleFilters,
	RoleListResponse,
	UpdateRoleInput,
} from "../shared/types.ts";

export function listRoles(filters: RoleFilters) {
	return isApi.get<RoleListResponse>(`/api/roles${buildQuery(filters)}`);
}

export async function getRole(id: string) {
	const { role } = await isApi.get<{ role: Role }>(`/api/roles/${id}`);
	return role;
}

export async function createRole(input: CreateRoleInput) {
	const { role } = await isApi.post<{ role: Role }>("/api/roles", input);
	return role;
}

export async function updateRole(id: string, input: UpdateRoleInput) {
	const { role } = await isApi.patch<{ role: Role }>(`/api/roles/${id}`, input);
	return role;
}

export function deleteRole(id: string) {
	return isApi.delete<StatusResponse>(`/api/roles/${id}`);
}
