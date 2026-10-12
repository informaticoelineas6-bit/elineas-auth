import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { CATALOG_STALE_TIME } from "@/modules/common/lib/query.ts";
import {
	assignPermissionFn,
	assignPermissionToRoleFn,
	listPermissionsBySystemFn,
	listPermissionsFn,
	listRolePermissionsFn,
	removePermissionFromSystemFn,
	unassignPermissionFromRoleFn,
	updatePermissionFn,
} from "../actions/permissions.ts";
import type {
	AssignPermissionInput,
	UpdatePermissionInput,
} from "../shared/types.ts";

export const permissionKeys = {
	all: ["permissions"] as const,
	bySystem: () => [...permissionKeys.all, "by-system"] as const,
	catalog: () => [...permissionKeys.all, "catalog"] as const,
	byRole: (roleId: string) =>
		[...permissionKeys.all, "by-role", roleId] as const,
};

export const permissionsQueries = {
	// Catálogo agrupado por sistema: cada card lo pide como fuente única, así
	// que se cachea igual que systems/roles (staleTime de catálogo).
	bySystem: () =>
		queryOptions({
			queryKey: permissionKeys.bySystem(),
			queryFn: () => listPermissionsBySystemFn(),
			staleTime: CATALOG_STALE_TIME,
			refetchOnWindowFocus: false,
		}),
	catalog: () =>
		queryOptions({
			queryKey: permissionKeys.catalog(),
			queryFn: () => listPermissionsFn(),
			staleTime: CATALOG_STALE_TIME,
			refetchOnWindowFocus: false,
		}),
	byRole: (roleId: string) =>
		queryOptions({
			queryKey: permissionKeys.byRole(roleId),
			queryFn: () => listRolePermissionsFn({ data: { id: roleId } }),
		}),
};

function invalidateBySystem(queryClient: ReturnType<typeof useQueryClient>) {
	return queryClient.invalidateQueries({ queryKey: permissionKeys.bySystem() });
}

export function useAssignPermission() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: AssignPermissionInput) =>
			assignPermissionFn({ data: input }),
		onSuccess: () => invalidateBySystem(queryClient),
	});
}

export function useUpdatePermission() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdatePermissionInput }) =>
			updatePermissionFn({ data: { id, body: input } }),
		onSuccess: () => invalidateBySystem(queryClient),
	});
}

export function useRemovePermissionFromSystem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, systemId }: { id: string; systemId: string }) =>
			removePermissionFromSystemFn({ data: { id, systemId } }),
		onSuccess: () => invalidateBySystem(queryClient),
	});
}

export function useAssignPermissionToRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, roleId }: { id: string; roleId: string }) =>
			assignPermissionToRoleFn({ data: { id, roleId } }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: permissionKeys.all }),
	});
}

export function useUnassignPermissionFromRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, roleId }: { id: string; roleId: string }) =>
			unassignPermissionFromRoleFn({ data: { id, roleId } }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: permissionKeys.all }),
	});
}
