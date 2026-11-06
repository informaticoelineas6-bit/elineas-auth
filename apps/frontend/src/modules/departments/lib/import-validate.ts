import {
	cleanBoolean,
	cleanString,
	describeZodError,
	type ImportRowResult,
	type RawImportRow,
} from "#/modules/common/lib/tabular.ts";
import type {
	CreateDepartmentInput,
	UpdateDepartmentInput,
} from "../shared/types.ts";
import {
	createDepartmentSchema,
	updateDepartmentSchema,
} from "./validation.ts";

const FIELD_LABELS: Record<string, string> = {
	name: "Nombre",
	description: "Descripción",
	active: "Activo",
};

// Valida y normaliza las filas "crudas" del archivo con las mismas reglas que el
// alta/edición. Con `id`, la fila actualiza ese departamento; sin `id`, crea uno.
export function mapDepartmentRows(
	rawRows: RawImportRow[],
): ImportRowResult<CreateDepartmentInput, UpdateDepartmentInput>[] {
	return rawRows.map((row, index) => {
		const rowNumber = index + 1;
		const id = cleanString(row.id);
		const payload = {
			name: cleanString(row.name),
			description: cleanString(row.description),
			active: cleanBoolean(row.active),
		};

		if (id) {
			const result = updateDepartmentSchema.safeParse(payload);
			if (!result.success) {
				return {
					kind: "error",
					row: rowNumber,
					message: describeZodError(result.error, FIELD_LABELS),
				};
			}
			return { kind: "update", row: rowNumber, id, input: result.data };
		}

		const result = createDepartmentSchema.safeParse(payload);
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
