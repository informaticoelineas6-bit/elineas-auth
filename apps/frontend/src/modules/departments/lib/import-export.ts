import {
	type ExportFormat,
	exportTable,
} from "#/modules/common/lib/tabular.ts";
import type { Department } from "../shared/types.ts";

// Columnas del CSV/JSON/Excel de departamentos. `id`, si viene informado al
// importar, hace que la fila actualice ese departamento; sin `id` crea uno nuevo.
export const DEPARTMENT_EXPORT_COLUMNS = [
	"id",
	"name",
	"description",
	"active",
] as const;

type DepartmentExportRow = Record<
	(typeof DEPARTMENT_EXPORT_COLUMNS)[number],
	string
>;

function departmentToRow(department: Department): DepartmentExportRow {
	return {
		id: department.id,
		name: department.name,
		description: department.description ?? "",
		active: String(department.active),
	};
}

export function exportDepartments(
	departments: Department[],
	format: ExportFormat,
) {
	return exportTable({
		rows: departments.map(departmentToRow),
		columns: DEPARTMENT_EXPORT_COLUMNS,
		format,
		filename: "departamentos",
		sheetName: "Departamentos",
	});
}
