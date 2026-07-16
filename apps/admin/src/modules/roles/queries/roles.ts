import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	createRoleFn,
	deleteRoleFn,
	getRoleFn,
	listRolesFn,
	updateRoleFn,
} from "../actions/roles.ts";
import type {
	CreateRoleInput,
	RoleFilters,
	UpdateRoleInput,
} from "../shared/types.ts";

export const roleKeys = {
	all: ["roles"] as const,
	lists: () => [...roleKeys.all, "list"] as const,
	list: (filters: RoleFilters) => [...roleKeys.lists(), filters] as const,
	details: () => [...roleKeys.all, "detail"] as const,
	detail: (id: string) => [...roleKeys.details(), id] as const,
};

export const rolesQueries = {
	list: (filters: RoleFilters = {}) =>
		queryOptions({
			queryKey: roleKeys.list(filters),
			queryFn: () => listRolesFn({ data: filters }),
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: roleKeys.detail(id),
			queryFn: () => getRoleFn({ data: { id } }),
		}),
};

export function useCreateRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateRoleInput) => createRoleFn({ data: input }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
	});
}

export function useUpdateRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) =>
			updateRoleFn({ data: { id, body: input } }),
		onSuccess: (_result, { id }) => {
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
			queryClient.invalidateQueries({ queryKey: roleKeys.detail(id) });
		},
	});
}

export function useDeleteRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteRoleFn({ data: { id } }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
	});
}
