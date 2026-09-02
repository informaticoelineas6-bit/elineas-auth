import {
	companyEmail,
	listSearchQuery,
	paginationQuery,
	password,
	id as sharedId,
} from "@elineas/auth-contracts";
import { z } from "zod";

// Las reglas que el servidor también aplica NO se escriben aquí: vienen de
// `@elineas/auth-contracts`, que es su única definición. Antes estaban
// duplicadas —la política de contraseña, el dominio corporativo y los límites
// de paginación estaban escritos tanto aquí como en
// `apps/api/src/openapi/*.schemas.ts`— y habían divergido de verdad.
//
// Se reexportan con los nombres que ya usaba el panel para no tocar los ~40
// sitios que las importan.
export const passwordSchema = password;
export const companyEmailSchema = companyEmail;
export const paginationQuerySchema = paginationQuery;
export const listSearchSchema = listSearchQuery;

export const themeSchema = z.enum(["light", "dark", "system"]);

export const idSchema = z.object({
	id: sharedId,
});

// `phoneSchema` vive en `common/lib/phone.ts` (importa libphonenumber-js, una
// dependencia pesada); se separó para no cargarla en el chunk compartido.

// Las fechas de negocio ("YYYY-MM-DD") y sus comparaciones viven en
// `@elineas/auth-contracts`; se reexportan para no cambiar los imports.
export { isNotFutureDate, todayIsoDate } from "@elineas/auth-contracts";
