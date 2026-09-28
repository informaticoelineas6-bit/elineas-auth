import { useForm } from "@tanstack/react-form";
import type { z } from "zod";
import type {
	AssignPermissionInput,
	SystemPermission,
	UpdatePermissionInput,
} from "../shared/types.ts";
import {
	assignPermissionFormSchema,
	updatePermissionFormSchema,
} from "./validation.ts";

export type AssignPermissionFormValues = z.infer<
	typeof assignPermissionFormSchema
>;

export function assignPermissionFormDefaults(
	systemId = "",
): AssignPermissionFormValues {
	return { systemId, roleId: "", resource: "", action: "", description: "" };
}

export function useAssignPermissionForm(
	defaultValues: AssignPermissionFormValues,
	onSubmit: (value: AssignPermissionFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues,
		validators: {
			onSubmit: assignPermissionFormSchema,
			onChange: assignPermissionFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

// Cuerpo del POST /api/permissions/assign: omite la descripción vacía para no
// persistir "".
export function toAssignPermissionPayload(
	value: AssignPermissionFormValues,
): AssignPermissionInput {
	const { systemId, roleId, resource, action, description } = value;
	return {
		systemId,
		roleId,
		resource,
		action,
		...(description ? { description } : {}),
	};
}

export type EditPermissionFormValues = z.infer<
	typeof updatePermissionFormSchema
>;

export function permissionToFormValues(
	permission: SystemPermission,
): EditPermissionFormValues {
	return {
		resource: permission.resource,
		action: permission.action,
		description: permission.description ?? "",
	};
}

export function useEditPermissionForm(
	defaultValues: EditPermissionFormValues,
	onSubmit: (value: EditPermissionFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues,
		validators: {
			onSubmit: updatePermissionFormSchema,
			onChange: updatePermissionFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export function toUpdatePermissionPayload(
	value: EditPermissionFormValues,
): UpdatePermissionInput {
	const { resource, action, description } = value;
	return {
		resource,
		action,
		...(description ? { description } : {}),
	};
}

export type AssignPermissionFormApi = ReturnType<
	typeof useAssignPermissionForm
>;
export type EditPermissionFormApi = ReturnType<typeof useEditPermissionForm>;
