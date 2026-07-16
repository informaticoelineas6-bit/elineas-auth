import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	createSystemFn,
	deleteSystemFn,
	getSystemFn,
	listSystemsFn,
	updateSystemFn,
} from "../actions/systems.ts";
import type {
	CreateSystemInput,
	SystemFilters,
	UpdateSystemInput,
} from "../shared/types.ts";

export const systemKeys = {
	all: ["systems"] as const,
	lists: () => [...systemKeys.all, "list"] as const,
	list: (filters: SystemFilters) => [...systemKeys.lists(), filters] as const,
	details: () => [...systemKeys.all, "detail"] as const,
	detail: (id: string) => [...systemKeys.details(), id] as const,
};

export const systemsQueries = {
	list: (filters: SystemFilters = {}) =>
		queryOptions({
			queryKey: systemKeys.list(filters),
			queryFn: () => listSystemsFn({ data: filters }),
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: systemKeys.detail(id),
			queryFn: () => getSystemFn({ data: { id } }),
		}),
};

export function useCreateSystem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateSystemInput) => createSystemFn({ data: input }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: systemKeys.all }),
	});
}

export function useUpdateSystem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateSystemInput }) =>
			updateSystemFn({ data: { id, body: input } }),
		onSuccess: (_result, { id }) => {
			queryClient.invalidateQueries({ queryKey: systemKeys.lists() });
			queryClient.invalidateQueries({ queryKey: systemKeys.detail(id) });
		},
	});
}

export function useDeleteSystem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteSystemFn({ data: { id } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: systemKeys.all }),
	});
}
