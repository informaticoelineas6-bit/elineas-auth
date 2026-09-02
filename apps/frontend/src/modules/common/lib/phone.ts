import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

// Validación de teléfono aislada en su propio módulo A PROPÓSITO: `libphonenumber-js`
// pesa ~275 KB y solo la usan los formularios de alta/edición de empleados (y el
// componente PhoneInput). Al no vivir en `common/lib/validation.ts` —que importa
// casi toda ruta por `listSearchSchema`/`idSchema`— evita arrastrar la librería
// al chunk compartido que se carga en login, dashboard, sesiones, roles, etc.
export const phoneSchema = z.string().refine(
	(val) => {
		const phone = parsePhoneNumberFromString(val);
		return phone?.isValid() ?? false;
	},
	{
		message: "Número de teléfono no válido para ningún país conocido",
	},
);
