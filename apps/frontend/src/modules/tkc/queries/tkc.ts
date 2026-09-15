import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { getUserTkcFn, removeUserTkcFn, setUserTkcFn } from "../actions/tkc.ts";
import type { TkcCredentialsInput } from "../shared/types.ts";

export const tkcKeys = {
	all: ["tkc"] as const,
	byUser: (userId: string) => [...tkcKeys.all, "user", userId] as const,
};

export const tkcQueries = {
	byUser: (userId: string) =>
		queryOptions({
			queryKey: tkcKeys.byUser(userId),
			queryFn: () => getUserTkcFn({ data: { id: userId } }),
		}),
};

export function useSetUserTkc() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			userId,
			...input
		}: TkcCredentialsInput & { userId: string }) =>
			setUserTkcFn({ data: { userId, ...input } }),
		onSuccess: (_result, { userId }) =>
			queryClient.invalidateQueries({ queryKey: tkcKeys.byUser(userId) }),
	});
}

export function useRemoveUserTkc() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (userId: string) => removeUserTkcFn({ data: { id: userId } }),
		onSuccess: (_result, userId) =>
			queryClient.invalidateQueries({ queryKey: tkcKeys.byUser(userId) }),
	});
}
