import {
	type ExportFormat,
	exportTable,
} from "#/modules/common/lib/tabular.ts";
import type { System } from "#/modules/systems/shared/types.ts";
import type { Role } from "../shared/types.ts";

// Columnas del CSV/JSON/Excel de roles. `id`, si viene informado al importar,
// hace que la fila actualice ese rol (solo nombre y descripción: el IS no
// permite cambiar el sistema de un rol); sin `id` crea uno nuevo. `system` es el
// SLUG del sistema, legible en una hoja de cálculo y estable entre entornos (a
// diferencia del id). `permissions` lista los permisos del rol como
// "recurso:acción" separados por ";" (p. ej. "users:read;users:write"); al
// importar se crean si no existen y se asignan al rol (nunca se quitan).
export const ROLE_EXPORT_COLUMNS = [
	"id",
	"system",
	"name",
	"description",
	"permissions",
] as const;

type RoleExportRow = Record<(typeof ROLE_EXPORT_COLUMNS)[number], string>;

function roleToRow(
	role: Role,
	systemsById: Map<string, System>,
	permissions: string[],
): RoleExportRow {
	return {
		id: role.id,
		system: systemsById.get(role.systemId)?.slug ?? "",
		name: role.name,
		description: role.description ?? "",
		permissions: permissions.join(";"),
	};
}

export function exportRoles(
	roles: Role[],
	systemsById: Map<string, System>,
	permissionsByRole: Map<string, string[]>,
	format: ExportFormat,
) {
	return exportTable({
		rows: roles.map((role) =>
			roleToRow(role, systemsById, permissionsByRole.get(role.id) ?? []),
		),
		columns: ROLE_EXPORT_COLUMNS,
		format,
		filename: "roles",
		sheetName: "Roles",
	});
}
