import {
	cleanString,
	describeZodError,
	type ImportRowResult,
	type RawImportRow,
} from "#/modules/common/lib/tabular.ts";
import type { CreateRoleInput, UpdateRoleInput } from "../shared/types.ts";
import { createRoleSchema, updateRoleSchema } from "./validation.ts";

const FIELD_LABELS: Record<string, string> = {
	systemId: "Sistema",
	name: "Nombre",
	description: "Descripción",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida y normaliza las filas "crudas" del archivo. Con `id`, la fila
// actualiza ese rol (nombre y descripción); sin `id`, crea uno nuevo y necesita
// el sistema: la columna `system` (slug) o, alternativamente, `systemId` (uuid).
// `systemsBySlug` resuelve el slug a su id.
export function mapRoleRows(
	rawRows: RawImportRow[],
	systemsBySlug: Map<string, string>,
): ImportRowResult<CreateRoleInput, UpdateRoleInput>[] {
	return rawRows.map((row, index) => {
		const rowNumber = index + 1;
		const id = cleanString(row.id);
		const name = cleanString(row.name);
		const description = cleanString(row.description);

		if (id) {
			const result = updateRoleSchema.safeParse({ name, description });
			if (!result.success) {
				return {
					kind: "error",
					row: rowNumber,
					message: describeZodError(result.error, FIELD_LABELS),
				};
			}
			return { kind: "update", row: rowNumber, id, input: result.data };
		}

		const slug = cleanString(row.system)?.toLowerCase();
		const directId = cleanString(row.systemId ?? row.systemid);
		let systemId: string | undefined;
		if (slug) {
			systemId = systemsBySlug.get(slug);
			if (!systemId) {
				return {
					kind: "error",
					row: rowNumber,
					message: `Sistema: no existe ningún sistema con el slug "${slug}"`,
				};
			}
		} else if (directId && UUID.test(directId)) {
			systemId = directId;
		}

		const result = createRoleSchema.safeParse({ systemId, name, description });
		if (!result.success) {
			return {
				kind: "error",
				row: rowNumber,
				message: describeZodError(result.error, FIELD_LABELS),
			};
		}
		return { kind: "create", row: rowNumber, input: result.data };
	});
}
