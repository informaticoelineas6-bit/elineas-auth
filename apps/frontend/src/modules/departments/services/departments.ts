import { buildQuery, isApi } from "#/modules/common/lib/api-client.ts";
import type { StatusResponse } from "#/modules/common/shared/types.ts";
import type {
	AddMembersInput,
	AddMembersResult,
	BulkCreateDepartmentsInput,
	BulkCreateResult,
	CreateDepartmentInput,
	Department,
	DepartmentFilters,
	DepartmentListResponse,
	DepartmentMember,
	UpdateDepartmentInput,
} from "../shared/types.ts";

export function listDepartments(filters: DepartmentFilters) {
	return isApi.get<DepartmentListResponse>(
		`/api/departments${buildQuery(filters)}`,
	);
}

export async function getDepartment(id: string) {
	const { department } = await isApi.get<{ department: Department }>(
		`/api/departments/${id}`,
	);
	return department;
}

export async function createDepartment(input: CreateDepartmentInput) {
	const { department } = await isApi.post<{ department: Department }>(
		"/api/departments",
		input,
	);
	return department;
}

export function bulkCreateDepartments(input: BulkCreateDepartmentsInput) {
	return isApi.post<BulkCreateResult>("/api/departments/bulk", input);
}

export async function updateDepartment(
	id: string,
	input: UpdateDepartmentInput,
) {
	const { department } = await isApi.patch<{ department: Department }>(
		`/api/departments/${id}`,
		input,
	);
	return department;
}

export function deleteDepartment(id: string) {
	return isApi.delete<StatusResponse>(`/api/departments/${id}`);
}

export async function listMembers(id: string) {
	const { members } = await isApi.get<{ members: DepartmentMember[] }>(
		`/api/departments/${id}/members`,
	);
	return members;
}

export function addMembers(id: string, input: AddMembersInput) {
	return isApi.post<AddMembersResult>(`/api/departments/${id}/members`, input);
}

export function setMemberHead(id: string, employeeId: string, isHead: boolean) {
	return isApi.patch<StatusResponse>(
		`/api/departments/${id}/members/${employeeId}`,
		{ isHead },
	);
}

export function removeMember(id: string, employeeId: string) {
	return isApi.delete<StatusResponse>(
		`/api/departments/${id}/members/${employeeId}`,
	);
}
