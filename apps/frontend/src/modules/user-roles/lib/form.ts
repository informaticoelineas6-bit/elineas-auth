import { useForm } from "@tanstack/react-form";
import type { z } from "zod";
import type { CreateUserRoleInput } from "../shared/types.ts";
import { assignUserRoleFormSchema } from "./validation.ts";

// Valores del formulario "Asignar rol". `systemId` solo acota la lista de roles;
// no viaja al IS (ver toCreateUserRolePayload). Se pueden elegir varios roles.
export type AssignUserRoleFormValues = z.infer<typeof assignUserRoleFormSchema>;

// Hook del formulario de asignación. `userId`/`systemId` se pueden prefijar
// (p. ej. al asignar desde la ficha de un empleado, con el usuario ya fijado).
export function useAssignUserRoleForm(
	defaults: Partial<Omit<AssignUserRoleFormValues, "roleIds">>,
	onSubmit: (value: AssignUserRoleFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues: {
			userId: defaults.userId ?? "",
			systemId: defaults.systemId ?? "",
			roleIds: [] as string[],
		},
		validators: {
			onSubmit: assignUserRoleFormSchema,
			onChange: assignUserRoleFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type AssignUserRoleFormApi = ReturnType<typeof useAssignUserRoleForm>;

// El IS solo recibe userId + roleId (una asignación por rol); el sistema se
// infiere del rol.
export function toCreateUserRolePayloads(
	value: AssignUserRoleFormValues,
): CreateUserRoleInput[] {
	return value.roleIds.map((roleId) => ({ userId: value.userId, roleId }));
}
