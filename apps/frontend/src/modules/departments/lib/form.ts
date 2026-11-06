import { useForm } from "@tanstack/react-form";
import type { z } from "zod";
import type {
	CreateDepartmentInput,
	Department,
	UpdateDepartmentInput,
} from "../shared/types.ts";
import { departmentFormSchema } from "./validation.ts";

export type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

export const departmentFormDefaults: DepartmentFormValues = {
	name: "",
	description: "",
	active: true,
};

export function useCreateDepartmentForm(
	onSubmit: (value: DepartmentFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues: departmentFormDefaults,
		validators: {
			onSubmit: departmentFormSchema,
			onChange: departmentFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export function departmentToFormValues(
	department: Department,
): DepartmentFormValues {
	return {
		name: department.name,
		description: department.description ?? "",
		active: department.active,
	};
}

export function useEditDepartmentForm(
	defaultValues: DepartmentFormValues,
	onSubmit: (value: DepartmentFormValues) => Promise<void> | void,
) {
	return useForm({
		defaultValues,
		validators: {
			onSubmit: departmentFormSchema,
			onChange: departmentFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type CreateDepartmentFormApi = ReturnType<
	typeof useCreateDepartmentForm
>;
export type EditDepartmentFormApi = ReturnType<typeof useEditDepartmentForm>;
export type DepartmentFormApi = CreateDepartmentFormApi | EditDepartmentFormApi;

// Omite la descripción vacía para no persistir "".
export function toDepartmentPayload(
	value: DepartmentFormValues,
): CreateDepartmentInput & UpdateDepartmentInput {
	const { name, description, active } = value;
	return { name, active, ...(description ? { description } : {}) };
}
