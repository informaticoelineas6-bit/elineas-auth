import type { ManagedSystem } from "@elineas/auth-contracts";
import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	CreateSystemInput,
	ServiceKeyCreated,
	ServiceKeyStatus,
	System,
	SystemFilters,
	SystemListResponse,
	UpdateSystemInput,
} from "../shared/types.ts";

// Sistemas que el usuario autenticado puede administrar (superadmin: todos;
// admin de sistema: los suyos; resto: ninguno). Ver GET /api/systems/managed.
export async function listManagedSystems() {
	const { isSuperAdmin, systems } = await isApi.get<{
		isSuperAdmin: boolean;
		systems: ManagedSystem[];
	}>("/api/systems/managed");
	return { isSuperAdmin, systems };
}

export function listSystems(filters: SystemFilters) {
	return isApi.get<SystemListResponse>(`/api/systems${buildQuery(filters)}`);
}

export async function getSystem(id: string) {
	const { system } = await isApi.get<{ system: System }>(`/api/systems/${id}`);
	return system;
}

export async function createSystem(input: CreateSystemInput) {
	const { system } = await isApi.post<{ system: System }>(
		"/api/systems",
		input,
	);
	return system;
}

export async function updateSystem(id: string, input: UpdateSystemInput) {
	const { system } = await isApi.patch<{ system: System }>(
		`/api/systems/${id}`,
		input,
	);
	return system;
}

export function deleteSystem(id: string) {
	return isApi.delete<StatusResponse>(`/api/systems/${id}`);
}

export function getServiceKeyStatus(id: string) {
	return isApi.get<ServiceKeyStatus>(`/api/systems/${id}/service-key`);
}

export function rotateServiceKey(id: string) {
	return isApi.post<ServiceKeyCreated>(`/api/systems/${id}/service-key`, {});
}

export function revokeServiceKey(id: string) {
	return isApi.delete<StatusResponse>(`/api/systems/${id}/service-key`);
}
