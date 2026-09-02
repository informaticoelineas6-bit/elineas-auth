import { useForm } from "@tanstack/react-form";
import type { z } from "zod";
import type {
	CreateRoleInput,
	Role,
	UpdateRoleInput,
} from "../shared/types.ts";
import { createRoleFormSchema, editRoleFormSchema } from "./validation.ts";

// Forma de los formularios de rol. `description` está siempre presente (arranca
// en "") para que el tipo del form case con el validador de TanStack Form.
export type CreateRoleFormValues = z.infer<typeof createRoleFormSchema>;
export type EditRoleFormValues = z.infer<typeof editRoleFormSchema>;

// Hook del formulario de creación. `systemId` se puede prefijar (p. ej. cuando
// se crea un rol desde un sistema concreto).
export function useCreateRoleForm(
	systemId: string,
	onSubmit: (value: CreateRoleFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues: { systemId, name: "", description: "" },
		validators: {
			onSubmit: createRoleFormSchema,
			onChange: createRoleFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

// Valores iniciales de la edición a partir del rol del IS (description null → "").
export function roleToFormValues(role: Role): EditRoleFormValues {
	return {
		name: role.name,
		description: role.description ?? "",
	};
}

export function useEditRoleForm(
	defaultValues: EditRoleFormValues,
	onSubmit: (value: EditRoleFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues,
		validators: {
			onSubmit: editRoleFormSchema,
			onChange: editRoleFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type CreateRoleFormApi = ReturnType<typeof useCreateRoleForm>;
export type EditRoleFormApi = ReturnType<typeof useEditRoleForm>;
export type RoleFormApi = CreateRoleFormApi | EditRoleFormApi;

// Cuerpos del POST/PATCH: omiten la descripción vacía para no persistir "".
export function toCreateRolePayload(
	value: CreateRoleFormValues,
): CreateRoleInput {
	const { systemId, name, description } = value;
	return {
		systemId,
		name,
		...(description ? { description } : {}),
	};
}

export function toUpdateRolePayload(
	value: EditRoleFormValues,
): UpdateRoleInput {
	const { name, description } = value;
	return {
		name,
		...(description ? { description } : {}),
	};
}
