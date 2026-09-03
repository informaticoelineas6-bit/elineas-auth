import { z } from "zod";
import { listSearchSchema } from "#/modules/common/lib/validation.ts";

// La revocación de una sesión concreta se hace por `id` (no por token): el
// listado ya no expone el token (secreto de portador).
export const revokeSessionSchema = z.object({
	sessionId: z.string().min(1),
});

// Filtros del listado administrativo: paginación + búsqueda libre por
// nombre/email del usuario dueño de la sesión.
export const sessionFiltersSchema = listSearchSchema;
