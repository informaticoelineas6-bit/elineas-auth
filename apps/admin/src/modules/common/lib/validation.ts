import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);

// Query de paginación compartida por todos los listados administrativos del IS
// (ver README del IS §10.2): `page` 1-indexado y `limit` acotado a [1, 100].
// z.coerce admite tanto el número que envía el cliente como su forma en string.
export const paginationQuerySchema = z.object({
	page: z.coerce
		.number()
		.int("Debe ser un número entero")
		.min(1, "Este campo es obligatorio")
		.default(1),
	limit: z.coerce
		.number()
		.int("Debe ser un número entero")
		.min(1, "Este campo es obligatorio")
		.max(100, "Debe tener menos de 100 caracteres")
		.default(20),
});

// Base de search params para cualquier listado administrativo: paginación +
// búsqueda libre. Cada recurso la extiende con sus filtros por columna (p. ej.
// `active`) y la usa tanto en `validateSearch` de la ruta como en el validator
// del server fn. Ver useListControls / DataTable.
export const listSearchSchema = paginationQuerySchema.extend({
	search: z.string().max(100, "Debe tener menos de 100 caracteres").optional(),
});

export const idSchema = z.object({
	id: z.string().min(1, "Este campo es obligatorio"),
});

// Dominio corporativo único admitido para cuentas del IS: el alta de usuarios
// no es autoservicio (la crea un admin), así que restringir el dominio evita
// cuentas con correos ajenos a la empresa. Se usa al CREAR una cuenta o
// CAMBIAR el correo, no al iniciar sesión (una cuenta ya existente conserva el
// correo que tenga, aunque fuera de un alta anterior a esta regla).
const COMPANY_EMAIL_DOMAIN = "mercadoelineas.com";

export const companyEmailSchema = z
	.email("Debe ser un correo electrónico válido")
	.refine((email) => email.toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`), {
		message: `El correo debe ser del dominio @${COMPANY_EMAIL_DOMAIN}`,
	});

export const passwordSchema = z
	.string()
	.min(12, "La contraseña debe tener al menos 12 caracteres")
	.max(128, "La contraseña no puede tener más de 128 caracteres")
	.refine((val) => /[A-Z]/.test(val), {
		message: "Debe contener al menos una letra mayúscula",
	})
	.refine((val) => /[a-z]/.test(val), {
		message: "Debe contener al menos una letra minúscula",
	})
	.refine((val) => /[^A-Za-z0-9]/.test(val), {
		message: "Debe contener al menos un carácter especial",
	});

// `phoneSchema` vive en `common/lib/phone.ts` (importa libphonenumber-js, una
// dependencia pesada); se separó para no cargarla en el chunk compartido.

// Fecha de hoy en el calendario local, como string "YYYY-MM-DD" (mismo formato
// que emite <input type="date">). Al ser ISO y zero-padded, se puede comparar
// lexicográficamente sin parsear a Date ni preocuparse por zonas horarias.
export function todayIsoDate(): string {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}

// Compara fechas "YYYY-MM-DD" sin ambigüedad de zona horaria (comparación de
// strings, válida porque el formato es ISO y de ancho fijo).
export function isNotFutureDate(value: string): boolean {
	return value <= todayIsoDate();
}
