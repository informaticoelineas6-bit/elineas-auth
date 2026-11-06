import { z } from "zod";
import { paginationQuerySchema } from "#/modules/common/lib/validation.ts";

// Filtros del listado, en su propio módulo (sin dependencias pesadas) porque el
// `validateSearch` de la ruta entra en el bundle de entrada. Ver employees/lib/filters.ts.
export const managedUserFiltersSchema = paginationQuerySchema.extend({
	search: z.string().max(100).optional(),
	systemId: z.string().optional(),
});
