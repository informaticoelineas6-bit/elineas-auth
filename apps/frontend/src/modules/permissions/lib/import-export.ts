import {
	type ExportFormat,
	exportTable,
} from "#/modules/common/lib/tabular.ts";
import type { SystemPermissions } from "../shared/types.ts";

// Una fila por (sistema, rol, permiso): `system` es el slug y `role` el nombre
// del rol dentro de ese sistema (legibles y estables entre entornos). Al
// importar, cada fila crea el permiso `resource:action` si no existe y lo
// asigna a ese rol (mismo efecto que "crear permiso" en el panel).
export const PERMISSION_EXPORT_COLUMNS = [
	"system",
	"role",
	"resource",
	"action",
	"description",
] as const;

type PermissionExportRow = Record<
	(typeof PERMISSION_EXPORT_COLUMNS)[number],
	string
>;

export function permissionsToRows(
	entries: SystemPermissions[],
): PermissionExportRow[] {
	const rows: PermissionExportRow[] = [];
	for (const { system, permissions } of entries) {
		for (const perm of permissions) {
			for (const role of perm.roles) {
				rows.push({
					system: system.slug,
					role: role.name,
					resource: perm.resource,
					action: perm.action,
					description: perm.description ?? "",
				});
			}
		}
	}
	return rows;
}

export function exportPermissions(
	entries: SystemPermissions[],
	format: ExportFormat,
) {
	return exportTable({
		rows: permissionsToRows(entries),
		columns: PERMISSION_EXPORT_COLUMNS,
		format,
		filename: "permisos",
		sheetName: "Permisos",
	});
}
