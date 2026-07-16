import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	createEmployeeFn,
	createEmployeeWithUserFn,
	deleteEmployeeFn,
	getEmployeeFn,
	listEmployeesFn,
	updateEmployeeFn,
} from "../actions/employees.ts";
import type {
	CreateEmployeeInput,
	CreateEmployeeWithUserInput,
	EmployeeFilters,
	UpdateEmployeeInput,
} from "../shared/types.ts";

export const employeeKeys = {
	all: ["employees"] as const,
	lists: () => [...employeeKeys.all, "list"] as const,
	list: (filters: EmployeeFilters) =>
		[...employeeKeys.lists(), filters] as const,
	details: () => [...employeeKeys.all, "detail"] as const,
	detail: (id: string) => [...employeeKeys.details(), id] as const,
};

export const employeesQueries = {
	list: (filters: EmployeeFilters = {}) =>
		queryOptions({
			queryKey: employeeKeys.list(filters),
			queryFn: () => listEmployeesFn({ data: filters }),
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: employeeKeys.detail(id),
			queryFn: () => getEmployeeFn({ data: { id } }),
		}),
};

export function useCreateEmployee() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateEmployeeInput) =>
			createEmployeeFn({ data: input }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
	});
}

export function useCreateEmployeeWithUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateEmployeeWithUserInput) =>
			createEmployeeWithUserFn({ data: input }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
	});
}

export function useUpdateEmployee() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateEmployeeInput }) =>
			updateEmployeeFn({ data: { id, body: input } }),
		onSuccess: (_result, { id }) => {
			queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
			queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) });
		},
	});
}

export function useDeleteEmployee() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteEmployeeFn({ data: { id } }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
	});
}
