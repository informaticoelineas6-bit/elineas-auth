import { z } from "zod";

// La revocación de una sesión concreta se hace por `id` (no por token): el
// listado ya no expone el token (secreto de portador).
export const revokeSessionSchema = z.object({
	sessionId: z.string().min(1),
});
