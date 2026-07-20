import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros del listado, EN SU PROPIO módulo a propósito: el `validateSearch` de
// la ruta (y por tanto el árbol de rutas, que es eager en el bundle de entrada)
// solo necesita esto. Separarlo de `validation.ts` —que arrastra `phoneSchema`
// → libphonenumber-js (~275 KB) por los formularios de alta/edición— evita que
// esa librería entre en el chunk de entrada que carga toda ruta (incluido el
// login). `active` se acepta como boolean y buildQuery lo serializa a
// "true"/"false", que es lo que el IS espera en la query string.
export const employeeFiltersSchema = paginationQuerySchema.extend({
	search: z.string().max(100).optional(),
	active: z.boolean().optional(),
});
