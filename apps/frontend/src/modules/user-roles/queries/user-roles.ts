import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	createUserRoleFn,
	deleteUserRoleFn,
	getUserRoleFn,
	inviteUserFn,
	listAllUserRolesFn,
	listUserDirectoryFn,
	listUserRolesFn,
	myUserRolesFn,
} from "../actions/user-roles.ts";
import type {
	CreateUserRoleInput,
	InviteUserInput,
	MyUserRolesQuery,
	UserDirectoryFilters,
	UserRoleFilters,
} from "../shared/types.ts";

export const userRoleKeys = {
	all: ["user-roles"] as const,
	lists: () => [...userRoleKeys.all, "list"] as const,
	list: (filters: UserRoleFilters) =>
		[...userRoleKeys.lists(), filters] as const,
	allFiltered: (filters: Omit<UserRoleFilters, "page" | "limit" | "view">) =>
		[...userRoleKeys.lists(), "all", filters] as const,
	details: () => [...userRoleKeys.all, "detail"] as const,
	detail: (id: string) => [...userRoleKeys.details(), id] as const,
	me: (systemSlug?: string) =>
		[...userRoleKeys.all, "me", systemSlug ?? null] as const,
	directories: () => [...userRoleKeys.all, "directory"] as const,
	directory: (filters: UserDirectoryFilters) =>
		[...userRoleKeys.directories(), filters] as const,
};

export const userRolesQueries = {
	// Directorio de usuarios para los selectores (búsqueda en el servidor).
	directory: (filters: UserDirectoryFilters = {}) =>
		queryOptions({
			queryKey: userRoleKeys.directory(filters),
			queryFn: () => listUserDirectoryFn({ data: filters }),
		}),
	list: (filters: UserRoleFilters = {}) =>
		queryOptions({
			queryKey: userRoleKeys.list(filters),
			queryFn: () => listUserRolesFn({ data: filters }),
		}),
	// Todas las asignaciones que cumplen los filtros (sin paginar): alimenta las
	// vistas de tarjetas, que agrupan en el cliente.
	allFiltered: (filters: Omit<UserRoleFilters, "page" | "limit" | "view">) =>
		queryOptions({
			queryKey: userRoleKeys.allFiltered(filters),
			queryFn: () => listAllUserRolesFn({ data: filters }),
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
		// Afecta los listados y, si te asignas un rol de consola a ti mismo, tus
		// roles (`me`, base del acceso admin). No hay `detail` que invalidar.
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: userRoleKeys.lists() });
			queryClient.invalidateQueries({ queryKey: userRoleKeys.me() });
			// Lista "Usuarios del sistema" (módulo managed-users; clave literal para
			// no crear un ciclo de imports entre ambos módulos).
			queryClient.invalidateQueries({ queryKey: ["managed-users"] });
		},
	});
}

export function useDeleteUserRole() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteUserRoleFn({ data: { id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: userRoleKeys.all });
			queryClient.invalidateQueries({ queryKey: ["managed-users"] });
		},
	});
}

// Exportar: petición puntual (botón "Exportar"), no un listado cacheado.
export function useExportUserRoles() {
	return useMutation({
		mutationFn: (filters: Omit<UserRoleFilters, "page" | "limit">) =>
			listAllUserRolesFn({ data: filters }),
	});
}

// Invitar a un usuario nuevo desde Asignaciones: refresca el directorio para que
// aparezca enseguida en los selectores.
export function useInviteUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: InviteUserInput) => inviteUserFn({ data: input }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: userRoleKeys.directories() }),
	});
}
