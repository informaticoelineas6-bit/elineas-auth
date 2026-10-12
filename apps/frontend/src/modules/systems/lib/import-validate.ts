import {
	cleanBoolean,
	cleanString,
	describeZodError,
	type ImportRowResult,
	type RawImportRow,
} from "#/modules/common/lib/tabular.ts";
import type { CreateSystemInput, UpdateSystemInput } from "../shared/types.ts";
import { createSystemSchema, updateSystemSchema } from "./validation.ts";

const FIELD_LABELS: Record<string, string> = {
	name: "Nombre",
	slug: "Slug",
	description: "Descripción",
	url: "URL",
	active: "Activo",
};

// Valida y normaliza las filas "crudas" del archivo con las mismas reglas que el
// alta/edición. Con `id`, la fila actualiza ese sistema; sin `id`, crea uno.
export function mapSystemRows(
	rawRows: RawImportRow[],
): ImportRowResult<CreateSystemInput, UpdateSystemInput>[] {
	return rawRows.map((row, index) => {
		const rowNumber = index + 1;
		const id = cleanString(row.id);
		const payload = {
			name: cleanString(row.name),
			slug: cleanString(row.slug)?.toLowerCase(),
			description: cleanString(row.description),
			url: cleanString(row.url),
			active: cleanBoolean(row.active),
		};

		if (id) {
			const result = updateSystemSchema.safeParse(payload);
			if (!result.success) {
				return {
					kind: "error",
					row: rowNumber,
					message: describeZodError(result.error, FIELD_LABELS),
				};
			}
			return { kind: "update", row: rowNumber, id, input: result.data };
		}

		const result = createSystemSchema.safeParse(payload);
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
