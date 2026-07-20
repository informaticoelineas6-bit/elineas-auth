import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	adminRevokeSessionFn,
	getCurrentSessionFn,
	listAllSessionsFn,
	listSessionsFn,
	revokeAllSessionsFn,
	revokeOtherSessionsFn,
} from "../actions/sessions.ts";
import type { SessionFilters } from "../shared/types.ts";

export const sessionKeys = {
	all: ["sessions"] as const,
	list: () => [...sessionKeys.all, "list"] as const,
	current: () => [...sessionKeys.all, "current"] as const,
	allLists: () => [...sessionKeys.all, "all-list"] as const,
	allList: (filters: SessionFilters) =>
		[...sessionKeys.allLists(), filters] as const,
};

export const sessionsQueries = {
	list: () =>
		queryOptions({
			queryKey: sessionKeys.list(),
			queryFn: () => listSessionsFn(),
		}),
	current: () =>
		queryOptions({
			queryKey: sessionKeys.current(),
			queryFn: () => getCurrentSessionFn(),
		}),
	// Listado administrativo: sesiones de todos los usuarios.
	allList: (filters: SessionFilters = {}) =>
		queryOptions({
			queryKey: sessionKeys.allList(filters),
			queryFn: () => listAllSessionsFn({ data: filters }),
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

// Revoca por id la sesión de CUALQUIER usuario (vista admin).
export function useAdminRevokeSession() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (sessionId: string) =>
			adminRevokeSessionFn({ data: { sessionId } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
	});
}
