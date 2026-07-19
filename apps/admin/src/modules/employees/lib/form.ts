import { useForm } from "@tanstack/react-form";
import type {
	CreateEmployeeWithUserFormInput,
	CreateEmployeeWithUserInput,
	EditEmployeeFormInput,
	Employee,
	UpdateEmployeeInput,
} from "../shared/types.ts";
import {
	createEmployeeWithUserFormSchema,
	editEmployeeFormSchema,
} from "./validation.ts";

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

// Fecha del IS (ISO datetime o null) → valor de <input type="date">.
function toDateInputValue(value: string | null): string {
	return value ? value.slice(0, 10) : "";
}

// Valores iniciales del formulario de edición a partir de la ficha del IS.
// Misma forma anidada `{ employee: ... }` que el alta para reutilizar
// EmployeeFields; los null del IS se convierten a cadena vacía.
export function employeeToFormValues(
	employee: Employee,
): EditEmployeeFormInput {
	return {
		employee: {
			name: employee.name,
			lastName: employee.lastName,
			ci: employee.ci,
			birthday: toDateInputValue(employee.birthday),
			phoneNumber: employee.phoneNumber ?? "",
			address: employee.address ?? "",
			inDate: toDateInputValue(employee.inDate),
			outDate: toDateInputValue(employee.outDate),
			active: employee.active,
		},
	};
}

// Hook del formulario de edición: mismos campos y validación que la sección
// de empleado del alta (issue #6 exige reutilizarla).
export function useEditEmployeeForm(
	defaultValues: EditEmployeeFormInput,
	onSubmit: (value: EditEmployeeFormInput) => Promise<void> | void,
) {
	return useForm({
		defaultValues,
		validators: {
			onSubmit: editEmployeeFormSchema,
			onChange: editEmployeeFormSchema,
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type EditEmployeeFormApi = ReturnType<typeof useEditEmployeeForm>;

// Convierte los valores del formulario de edición en el cuerpo del PATCH.
// Los opcionales vacíos se omiten (el IS coacciona fechas con z.coerce.date()
// y un "" sería inválido); por tanto, vaciar un campo opcional que ya tenía
// valor no lo borra en el IS — limitación de UpdateEmployeeBody, que no acepta
// null explícito.
export function toUpdateEmployeePayload(
	value: EditEmployeeFormInput,
): UpdateEmployeeInput {
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
		name,
		lastName,
		ci,
		active,
		...(birthday ? { birthday } : {}),
		...(phoneNumber ? { phoneNumber } : {}),
		...(address ? { address } : {}),
		...(inDate ? { inDate } : {}),
		...(outDate ? { outDate } : {}),
	};
}

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
