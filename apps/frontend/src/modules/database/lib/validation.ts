import { currentPassword } from "@elineas/auth-contracts";
import { z } from "zod";

// Re-autenticación del admin antes de exportar la base de datos. Espeja
// DatabaseExportBody del servidor.
export const exportDatabaseSchema = z.object({
	currentPassword,
});

export type ExportDatabaseInput = z.infer<typeof exportDatabaseSchema>;
