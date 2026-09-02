import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	CreateUserRoleInput,
	MyUserRole,
	MyUserRolesQuery,
	UserRole,
	UserRoleFilters,
	UserRoleListResponse,
} from "../shared/types.ts";

export function listUserRoles(filters: UserRoleFilters) {
	return isApi.get<UserRoleListResponse>(
		`/api/user-roles${buildQuery(filters)}`,
	);
}

export async function getUserRole(id: string) {
	const { userRole } = await isApi.get<{ userRole: UserRole }>(
		`/api/user-roles/${id}`,
	);
	return userRole;
}

export async function createUserRole(input: CreateUserRoleInput) {
	const { userRole } = await isApi.post<{ userRole: UserRole }>(
		"/api/user-roles",
		input,
	);
	return userRole;
}

export function deleteUserRole(id: string) {
	return isApi.delete<StatusResponse>(`/api/user-roles/${id}`);
}

export async function listMyRoles(query: MyUserRolesQuery = {}) {
	const { roles } = await isApi.get<{ roles: MyUserRole[] }>(
		`/api/user-roles/me${buildQuery(query)}`,
	);
	return roles;
}
