import {
	keepPreviousData,
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { userRoleKeys } from "@/modules/user-roles/queries/user-roles.ts";
import {
	listManagedUsersFn,
	resendManagedUserInviteFn,
	updateManagedUserFn,
} from "../actions/managed-users.ts";
import type {
	ManagedUserFilters,
	UpdateManagedUserInput,
} from "../shared/types.ts";

export const managedUserKeys = {
	all: ["managed-users"] as const,
	list: (filters: ManagedUserFilters) =>
		[...managedUserKeys.all, "list", filters] as const,
};

export const managedUsersQueries = {
	list: (filters: ManagedUserFilters = {}) =>
		queryOptions({
			queryKey: managedUserKeys.list(filters),
			queryFn: () => listManagedUsersFn({ data: filters }),
			placeholderData: keepPreviousData,
		}),
};

export function useUpdateManagedUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateManagedUserInput }) =>
			updateManagedUserFn({ data: { id, body } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: managedUserKeys.all });
			queryClient.invalidateQueries({ queryKey: userRoleKeys.directories() });
		},
	});
}

export function useResendManagedUserInvite() {
	return useMutation({
		mutationFn: (id: string) => resendManagedUserInviteFn({ data: { id } }),
	});
}
