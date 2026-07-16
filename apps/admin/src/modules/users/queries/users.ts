import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	changeEmailFn,
	changePasswordFn,
	getMeFn,
	updateMeFn,
} from "../actions/users.ts";
import type {
	ChangeEmailInput,
	ChangePasswordInput,
	UpdateProfileInput,
} from "../shared/types.ts";

export const userKeys = {
	all: ["users"] as const,
	me: () => [...userKeys.all, "me"] as const,
};

export const usersQueries = {
	me: () =>
		queryOptions({
			queryKey: userKeys.me(),
			queryFn: () => getMeFn(),
		}),
};

export function useUpdateProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateProfileInput) => updateMeFn({ data: input }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.me() }),
	});
}

export function useChangePassword() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ChangePasswordInput) =>
			changePasswordFn({ data: input }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.me() }),
	});
}

export function useChangeEmail() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ChangeEmailInput) => changeEmailFn({ data: input }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.me() }),
	});
}
