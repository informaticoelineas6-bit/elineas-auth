import { useForm } from "@tanstack/react-form";
import type {
	CreateEmployeeWithUserFormInput,
	CreateEmployeeWithUserInput,
} from "../shared/types.ts";
import { createEmployeeWithUserFormSchema } from "./validation.ts";

// Valores iniciales del alta combinada. Los opcionales del empleado arrancan
// vacíos (se depuran antes de enviar); el empleado nace activo por defecto.
export const employeeWithUserFormDefaults: CreateEmployeeWithUserFormInput = {
	user: { name: "", email: "", password: "" },
	confirmPassword: "",
	employee: {
		name: "",
		lastName: "",
		ci: "",
		birthday: "",
		phoneNumber: "",
		address: "",
		inDate: "",
		outDate: "",
		active: true,
	},
};

// Hook del formulario de alta: fija defaults + validación cliente y expone solo
// el `onSubmit`. Devolver el form desde aquí permite tipar los grupos de campos
// (UserAccountFields / EmployeeFields) con `EmployeeWithUserFormApi` sin repetir
// los genéricos de @tanstack/react-form.
export function useEmployeeWithUserForm(
	onSubmit: (value: CreateEmployeeWithUserFormInput) => Promise<void> | void,
) {
	return useForm({
		defaultValues: employeeWithUserFormDefaults,
		validators: {
			onSubmit: createEmployeeWithUserFormSchema,
			onChange: createEmployeeWithUserFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type EmployeeWithUserFormApi = ReturnType<
	typeof useEmployeeWithUserForm
>;

// Convierte los valores del formulario en el cuerpo del POST /with-user:
// descarta `confirmPassword` y omite los opcionales vacíos del empleado para no
// enviar cadenas vacías al IS (que coacciona fechas con z.coerce.date()).
export function toCreateEmployeeWithUserPayload(
	value: CreateEmployeeWithUserFormInput,
): CreateEmployeeWithUserInput {
	const {
		name,
		lastName,
		ci,
		birthday,
		phoneNumber,
		address,
		inDate,
		outDate,
		active,
	} = value.employee;

	return {
		user: {
			name: value.user.name,
			email: value.user.email,
			password: value.user.password,
		},
		employee: {
			name,
			lastName,
			ci,
			active,
			...(birthday ? { birthday } : {}),
			...(phoneNumber ? { phoneNumber } : {}),
			...(address ? { address } : {}),
			...(inDate ? { inDate } : {}),
			...(outDate ? { outDate } : {}),
		},
	};
}
