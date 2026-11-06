import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { sessionKeys } from "#/modules/sessions/queries/sessions.ts";
import {
	adminChangeUserPasswordFn,
	changeManagedUserPasswordFn,
	changeEmailFn,
	changePasswordFn,
	getMeFn,
	updateMeFn,
} from "../actions/users.ts";
import type {
	AdminChangePasswordInput,
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

// Cambio de contraseña de OTRO usuario (acción de admin). Al revocar sus
// sesiones cambia el listado de sesiones activas, así que se invalida: si no,
// la página de sesiones seguiría mostrando las que acaban de cerrarse.
//
// `managed`: lo ejecuta un admin de sistema sobre un usuario de su sistema (el
// IS aplica además la regla de cuenta no compartida), no el superadmin.
export function useAdminChangeUserPassword({
	managed = false,
}: {
	managed?: boolean;
} = {}) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			userId,
			...input
		}: AdminChangePasswordInput & { userId: string }) =>
			(managed ? changeManagedUserPasswordFn : adminChangeUserPasswordFn)({
				data: { userId, ...input },
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
	});
}
