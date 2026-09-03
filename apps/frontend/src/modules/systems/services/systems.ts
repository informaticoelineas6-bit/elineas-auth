import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	CreateSystemInput,
	System,
	SystemFilters,
	SystemListResponse,
	UpdateSystemInput,
} from "../shared/types.ts";

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
