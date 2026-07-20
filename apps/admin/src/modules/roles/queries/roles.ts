import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { CATALOG_STALE_TIME } from "@/modules/common/lib/query.ts";
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
			// Catálogo estable: varias vistas lo piden como fuente de nombres.
			staleTime: CATALOG_STALE_TIME,
			refetchOnWindowFocus: false,
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
		// Un alta solo afecta a los listados; no hay `detail` que invalidar.
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() }),
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
