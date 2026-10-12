import {
	type ExportFormat,
	exportTable,
} from "#/modules/common/lib/tabular.ts";
import type { System } from "../shared/types.ts";

// Columnas del CSV/JSON/Excel de sistemas. `id`, si viene informado al importar,
// hace que la fila actualice ese sistema; sin `id` crea uno nuevo.
export const SYSTEM_EXPORT_COLUMNS = [
	"id",
	"name",
	"slug",
	"description",
	"url",
	"active",
] as const;

type SystemExportRow = Record<(typeof SYSTEM_EXPORT_COLUMNS)[number], string>;

function systemToRow(system: System): SystemExportRow {
	return {
		id: system.id,
		name: system.name,
		slug: system.slug,
		description: system.description ?? "",
		url: system.url ?? "",
		active: String(system.active),
	};
}

export function exportSystems(systems: System[], format: ExportFormat) {
	return exportTable({
		rows: systems.map(systemToRow),
		columns: SYSTEM_EXPORT_COLUMNS,
		format,
		filename: "sistemas",
		sheetName: "Sistemas",
	});
}
