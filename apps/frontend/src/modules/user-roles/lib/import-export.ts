import {
	type ExportFormat,
	exportTable,
} from "#/modules/common/lib/tabular.ts";
import type { UserRoleDetail } from "../shared/types.ts";

// Columnas del CSV/JSON/Excel de asignaciones. Son de solo lectura (no hay
// importación): `system` es el slug, legible y estable entre entornos.
export const USER_ROLE_EXPORT_COLUMNS = [
	"id",
	"user",
	"email",
	"role",
	"system",
	"assignedAt",
] as const;

type UserRoleExportRow = Record<
	(typeof USER_ROLE_EXPORT_COLUMNS)[number],
	string
>;

// `usersById` aporta el nombre del empleado enlazado (más completo que el de la
// cuenta); sin él se usa el nombre de la cuenta, y en último caso el id.
function userRoleToRow(
	userRole: UserRoleDetail,
	usersById: Map<string, { name: string; email: string }>,
): UserRoleExportRow {
	const user = usersById.get(userRole.userId) ?? userRole.user;
	return {
		id: userRole.id,
		user: user?.name ?? userRole.userId,
		email: user?.email ?? "",
		role: userRole.role.name,
		system: userRole.system.slug,
		assignedAt: userRole.createdAt,
	};
}

export function exportUserRoles(
	userRoles: UserRoleDetail[],
	usersById: Map<string, { name: string; email: string }>,
	format: ExportFormat,
) {
	return exportTable({
		rows: userRoles.map((userRole) => userRoleToRow(userRole, usersById)),
		columns: USER_ROLE_EXPORT_COLUMNS,
		format,
		filename: "asignaciones",
		sheetName: "Asignaciones",
	});
}
