import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	listSessionsFn,
	revokeAllSessionsFn,
	revokeOtherSessionsFn,
	revokeSessionFn,
} from "../actions/sessions.ts";

export const sessionKeys = {
	all: ["sessions"] as const,
	list: () => [...sessionKeys.all, "list"] as const,
};

export const sessionsQueries = {
	list: () =>
		queryOptions({
			queryKey: sessionKeys.list(),
			queryFn: () => listSessionsFn(),
		}),
};

export function useRevokeAllSessions() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => revokeAllSessionsFn(),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
	});
}

export function useRevokeOtherSessions() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => revokeOtherSessionsFn(),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
	});
}

export function useRevokeSession() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (sessionId: string) => revokeSessionFn({ data: { sessionId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
	});
}
