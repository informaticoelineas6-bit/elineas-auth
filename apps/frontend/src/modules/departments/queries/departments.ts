import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { CATALOG_STALE_TIME } from "@/modules/common/lib/query.ts";
import {
	addMembersFn,
	bulkCreateDepartmentsFn,
	createDepartmentFn,
	deleteDepartmentFn,
	getDepartmentFn,
	listAllDepartmentsFn,
	listDepartmentsFn,
	listMembersFn,
	removeMemberFn,
	setMemberHeadFn,
	updateDepartmentFn,
} from "../actions/departments.ts";
import type {
	AddMembersInput,
	BulkCreateDepartmentsInput,
	CreateDepartmentInput,
	DepartmentFilters,
	UpdateDepartmentInput,
} from "../shared/types.ts";

export const departmentKeys = {
	all: ["departments"] as const,
	lists: () => [...departmentKeys.all, "list"] as const,
	list: (filters: DepartmentFilters) =>
		[...departmentKeys.lists(), filters] as const,
	details: () => [...departmentKeys.all, "detail"] as const,
	detail: (id: string) => [...departmentKeys.details(), id] as const,
	members: (id: string) => [...departmentKeys.all, "members", id] as const,
};

export const departmentsQueries = {
	list: (filters: DepartmentFilters = {}) =>
		queryOptions({
			queryKey: departmentKeys.list(filters),
			queryFn: () => listDepartmentsFn({ data: filters }),
			staleTime: CATALOG_STALE_TIME,
			refetchOnWindowFocus: false,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: departmentKeys.detail(id),
			queryFn: () => getDepartmentFn({ data: { id } }),
		}),
	members: (id: string) =>
		queryOptions({
			queryKey: departmentKeys.members(id),
			queryFn: () => listMembersFn({ data: { id } }),
		}),
};

export function useCreateDepartment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateDepartmentInput) =>
			createDepartmentFn({ data: input }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: departmentKeys.lists() }),
	});
}

export function useBulkCreateDepartments() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: BulkCreateDepartmentsInput) =>
			bulkCreateDepartmentsFn({ data: input }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: departmentKeys.lists() }),
	});
}

export function useUpdateDepartment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentInput }) =>
			updateDepartmentFn({ data: { id, body: input } }),
		onSuccess: (_result, { id }) => {
			queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
			queryClient.invalidateQueries({ queryKey: departmentKeys.detail(id) });
		},
	});
}

export function useDeleteDepartment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteDepartmentFn({ data: { id } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: departmentKeys.all }),
	});
}

// Los cambios de miembros afectan a la tarjeta, al nº de miembros del listado
// y a los departamentos que muestran las fichas de empleado.
function invalidateMembership(
	queryClient: ReturnType<typeof useQueryClient>,
	id: string,
) {
	queryClient.invalidateQueries({ queryKey: departmentKeys.members(id) });
	queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
	queryClient.invalidateQueries({ queryKey: ["employees"] });
}

export function useAddDepartmentMembers() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: AddMembersInput }) =>
			addMembersFn({ data: { id, body: input } }),
		onSuccess: (_result, { id }) => invalidateMembership(queryClient, id),
	});
}

export function useSetMemberHead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (v: { id: string; employeeId: string; isHead: boolean }) =>
			setMemberHeadFn({ data: v }),
		onSuccess: (_result, { id }) => invalidateMembership(queryClient, id),
	});
}

export function useRemoveDepartmentMember() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (v: { id: string; employeeId: string }) =>
			removeMemberFn({ data: v }),
		onSuccess: (_result, { id }) => invalidateMembership(queryClient, id),
	});
}

// Exportar: petición puntual (disparada por el botón "Exportar"), no un listado
// cacheado, por eso es una mutation y no una query.
export function useExportDepartments() {
	return useMutation({
		mutationFn: (filters: Omit<DepartmentFilters, "page" | "limit">) =>
			listAllDepartmentsFn({ data: filters }),
	});
}
