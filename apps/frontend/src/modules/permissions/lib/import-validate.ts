import {
	cleanString,
	describeZodError,
	type ImportRowResult,
	type RawImportRow,
} from "#/modules/common/lib/tabular.ts";
import type { AssignPermissionInput } from "../shared/types.ts";
import { assignPermissionSchema } from "./validation.ts";

const FIELD_LABELS: Record<string, string> = {
	systemId: "Sistema",
	roleId: "Rol",
	resource: "Recurso",
	action: "Acción",
	description: "Descripción",
};

export type RoleLookup = { systemId: string; roleId: string };

export const roleLookupKey = (systemSlug: string, roleName: string) =>
	`${systemSlug.trim().toLowerCase()}|${roleName.trim().toLowerCase()}`;

// Cada fila es una asignación (sistema + rol + recurso:acción). Reimportar el
// mismo archivo es inocuo: el permiso se reutiliza y la asignación no se
// duplica. No existe "update": un permiso se identifica por recurso:acción.
export function mapPermissionRows(
	rawRows: RawImportRow[],
	rolesByKey: Map<string, RoleLookup>,
): ImportRowResult<AssignPermissionInput, never>[] {
	return rawRows.map((row, index) => {
		const rowNumber = index + 1;
		const fail = (message: string) =>
			({ kind: "error", row: rowNumber, message }) as const;

		const system = cleanString(row.system);
		const roleName = cleanString(row.role);
		if (!system) return fail("Sistema: es obligatorio (slug del sistema)");
		if (!roleName) return fail("Rol: es obligatorio (nombre del rol)");
		const role = rolesByKey.get(roleLookupKey(system, roleName));
		if (!role) {
			return fail(`Rol: no existe "${roleName}" en el sistema "${system}"`);
		}

		const result = assignPermissionSchema.safeParse({
			systemId: role.systemId,
			roleId: role.roleId,
			resource: cleanString(row.resource),
			action: cleanString(row.action),
			description: cleanString(row.description),
		});
		if (!result.success) {
			return fail(describeZodError(result.error, FIELD_LABELS));
		}
		return { kind: "create", row: rowNumber, input: result.data };
	});
}
