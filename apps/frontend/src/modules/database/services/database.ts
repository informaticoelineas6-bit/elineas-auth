import { databaseRpc, unwrap } from "#/modules/common/lib/rpc.ts";
import type { ExportDatabaseInput } from "../lib/validation.ts";

// Genera en el IS el volcado SQL (esquema + datos, sin secretos). Requiere rol
// admin; `currentPassword` es la del ADMIN que exporta.
export function exportDatabase(input: ExportDatabaseInput) {
	return unwrap(databaseRpc.export.$post({ json: input }));
}
