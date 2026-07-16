import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	createUserRoleFn,
	deleteUserRoleFn,
	getUserRoleFn,
	listUserRolesFn,
	myUserRolesFn,
} from "../actions/user-roles.ts";
import type {
	CreateUserRoleInput,
	MyUserRolesQuery,
	UserRoleFilters,
} from "../shared/types.ts";

export const userRoleKeys = {
	all: ["user-roles"] as const,
	lists: () => [...userRoleKeys.all, "list"] as const,
	list: (filters: UserRoleFilters) =>
		[...userRoleKeys.lists(), filters] as const,
	details: () => [...userRoleKeys.all, "detail"] as const,
	detail: (id: string) => [...userRoleKeys.details(), id] as const,
	me: (systemSlug?: string) =>
		[...userRoleKeys.all, "me", systemSlug ?? null] as const,
};

export const userRolesQueries = {
	list: (filters: UserRoleFilters = {}) =>
		queryOptions({
			queryKey: userRoleKeys.list(filters),
			queryFn: () => listUserRolesFn({ data: filters }),
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: userRoleKeys.detail(id),
			queryFn: () => getUserRoleFn({ data: { id } }),
		}),
	me: (query: MyUserRolesQuery = {}) =>
		queryOptions({
			queryKey: userRoleKeys.me(query.systemSlug),
			queryFn: () => myUserRolesFn({ data: query }),
		}),
};

export function useCreateUserRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateUserRoleInput) =>
			createUserRoleFn({ data: input }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: userRoleKeys.all }),
	});
}

export function useDeleteUserRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteUserRoleFn({ data: { id } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: userRoleKeys.all }),
	});
}
