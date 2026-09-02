import { useForm } from "@tanstack/react-form";
import type { z } from "zod";
import type { CreateUserRoleInput } from "../shared/types.ts";
import { assignUserRoleFormSchema } from "./validation.ts";

// Valores del formulario "Asignar rol". `systemId` solo acota el select de rol;
// no viaja al IS (ver toCreateUserRolePayload).
export type AssignUserRoleFormValues = z.infer<typeof assignUserRoleFormSchema>;

// Hook del formulario de asignación. `userId`/`systemId` se pueden prefijar
// (p. ej. al asignar desde la ficha de un empleado, con el usuario ya fijado).
export function useAssignUserRoleForm(
	defaults: Partial<AssignUserRoleFormValues>,
	onSubmit: (value: AssignUserRoleFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues: {
			userId: defaults.userId ?? "",
			systemId: defaults.systemId ?? "",
			roleId: defaults.roleId ?? "",
		},
		validators: {
			onSubmit: assignUserRoleFormSchema,
			onChange: assignUserRoleFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type AssignUserRoleFormApi = ReturnType<typeof useAssignUserRoleForm>;

// El IS solo recibe userId + roleId; el sistema se infiere del rol.
export function toCreateUserRolePayload(
	value: AssignUserRoleFormValues,
): CreateUserRoleInput {
	return { userId: value.userId, roleId: value.roleId };
}
