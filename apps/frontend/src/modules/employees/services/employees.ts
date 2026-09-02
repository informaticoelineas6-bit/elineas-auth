import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	CreateEmployeeInput,
	CreateEmployeeWithUserInput,
	Employee,
	EmployeeFilters,
	EmployeeListResponse,
	EmployeeWithUserResult,
	UpdateEmployeeInput,
} from "../shared/types.ts";

export function listEmployees(filters: EmployeeFilters) {
	return isApi.get<EmployeeListResponse>(
		`/api/employees${buildQuery(filters)}`,
	);
}

export async function getEmployee(id: string) {
	const { employee } = await isApi.get<{ employee: Employee }>(
		`/api/employees/${id}`,
	);
	return employee;
}

export async function createEmployee(input: CreateEmployeeInput) {
	const { employee } = await isApi.post<{ employee: Employee }>(
		"/api/employees",
		input,
	);
	return employee;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
	const { employee } = await isApi.patch<{ employee: Employee }>(
		`/api/employees/${id}`,
		input,
	);
	return employee;
}

export function deleteEmployee(id: string) {
	return isApi.delete<StatusResponse>(`/api/employees/${id}`);
}

export function createEmployeeWithUser(input: CreateEmployeeWithUserInput) {
	return isApi.post<EmployeeWithUserResult>("/api/employees/with-user", input);
}
