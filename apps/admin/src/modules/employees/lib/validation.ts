import { z } from "zod";
import {
	isNotFutureDate,
	paginationQuerySchema,
	passwordSchema,
	phoneSchema,
} from "#/modules/common/lib/validation.ts";

// Filtros de listado: paginación + búsqueda libre (nombre/apellido/CI) y estado.
// `active` se acepta como boolean y buildQuery lo serializa a "true"/"false",
// que es lo que el IS espera en la query string.
export const employeeFiltersSchema = paginationQuerySchema.extend({
	search: z.string().max(100).optional(),
	active: z.boolean().optional(),
});

// Forma base compartida por alta y edición. Las fechas viajan como string ISO
// ("YYYY-MM-DD" del <input type="date">); el IS las coacciona con
// z.coerce.date() en su extremo. Las reglas cruzadas (no-futuro, baja ≥ alta)
// se añaden aparte con `applyEmployeeDateRules`, porque `.omit()`/`.partial()`
// solo existen en ZodObject y no en el resultado de un `.superRefine()`.
const employeeBaseSchema = z.object({
	userId: z.string().max(100).optional(),
	name: z
		.string()
		.min(1, "Debe tener al menos 1 caracter")
		.max(100, "Debe tener menos de 100 caracteres"),
	lastName: z
		.string()
		.min(1, "Debe tener al menos 1 caracter")
		.max(100, "Debe tener menos de 100 caracteres"),
	ci: z
		.string()
		.min(11, "El CI debe tener 11 dígitos")
		.max(11, "El CI debe tener 11 dígitos"),
	birthday: z.string().optional(),
	phoneNumber: phoneSchema.optional(),
	address: z.string().max(300, "Debe tener menos de 300 caracteres").optional(),
	inDate: z.string().optional(),
	outDate: z.string().optional(),
	active: z.boolean().optional(),
});

// Genérica sobre `T` (no solo su Output) para no perder el tipo de entrada del
// ZodObject original: `superRefine` devuelve `this`, así que con `T` de por
// medio conservamos el schema exacto (con su `.omit()`/`.partial()` ya
// aplicado) en vez de degradarlo a un ZodType<Output, unknown> genérico.
function applyEmployeeDateRules<T extends z.ZodObject<z.ZodRawShape>>(
	schema: T,
): T {
	return schema.superRefine((raw, ctx) => {
		// `T` es genérico sobre cualquier forma de ZodObject (para preservar el
		// tipo exacto en el retorno), así que aquí solo se tipan los tres campos
		// que esta regla necesita; el resto de `raw` es irrelevante para ella.
		const value = raw as {
			birthday?: string;
			inDate?: string;
			outDate?: string;
		};
		if (value.birthday && !isNotFutureDate(value.birthday)) {
			ctx.addIssue({
				code: "custom",
				path: ["birthday"],
				message: "La fecha de nacimiento no puede ser posterior a hoy",
			});
		}
		if (value.inDate && !isNotFutureDate(value.inDate)) {
			ctx.addIssue({
				code: "custom",
				path: ["inDate"],
				message: "La fecha de alta no puede ser posterior a hoy",
			});
		}
		if (value.outDate && !isNotFutureDate(value.outDate)) {
			ctx.addIssue({
				code: "custom",
				path: ["outDate"],
				message: "La fecha de baja no puede ser posterior a hoy",
			});
		}
		if (value.inDate && value.outDate && value.outDate < value.inDate) {
			ctx.addIssue({
				code: "custom",
				path: ["outDate"],
				message: "La fecha de baja no puede ser anterior a la de alta",
			});
		}
	});
}

export const createEmployeeSchema = applyEmployeeDateRules(employeeBaseSchema);

export const updateEmployeeSchema = applyEmployeeDateRules(
	employeeBaseSchema.partial(),
);

// Sección "empleado" de los formularios (alta combinada y edición): mismos
// campos y reglas que el alta, sin `userId` (el enlace usuario-empleado no se
// gestiona desde estos formularios).
export const employeeSectionSchema = applyEmployeeDateRules(
	employeeBaseSchema.omit({ userId: true }),
);

// Esquema del formulario de edición (solo cliente). Conserva la forma anidada
// `{ employee: ... }` del alta para que EmployeeFields sirva a ambos formularios
// con los mismos nombres de campo ("employee.name", …).
export const editEmployeeFormSchema = z.object({
	employee: employeeSectionSchema,
});

// Alta combinada usuario + empleado (POST /api/employees/with-user). El `userId`
// del empleado lo fija el servidor con el id del usuario recién creado, por eso
// se omite aquí.
export const createEmployeeWithUserSchema = z.object({
	user: z.object({
		name: z
			.string()
			.min(1, "Debe tener al menos 1 caracter")
			.max(100, "Debe tener menos de 100 caracteres"),
		email: z.email("Debe ser un correo electrónico válido"),
		password: passwordSchema,
		image: z.string().optional(),
	}),
	employee: employeeSectionSchema,
});

// Esquema del formulario de alta (solo cliente): espeja las reglas del servidor
// y añade la confirmación de contraseña. `confirmPassword` no se envía al IS.
export const createEmployeeWithUserFormSchema = createEmployeeWithUserSchema
	.extend({
		confirmPassword: z.string().min(1, "Confirma la contraseña"),
	})
	.refine((value) => value.user.password === value.confirmPassword, {
		message: "Las contraseñas no coinciden",
		path: ["confirmPassword"],
	});
