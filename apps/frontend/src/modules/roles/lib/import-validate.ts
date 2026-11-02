import {
	cleanString,
	describeZodError,
	type ImportRowResult,
	type RawImportRow,
} from "#/modules/common/lib/tabular.ts";
import type { CreateRoleInput, UpdateRoleInput } from "../shared/types.ts";
import { createRoleSchema, updateRoleSchema } from "./validation.ts";

export type PermissionSpec = { resource: string; action: string };
export type RoleImportCreate = CreateRoleInput & {
	permissions: PermissionSpec[];
};
export type RoleImportUpdate = UpdateRoleInput & {
	permissions: PermissionSpec[];
	// Sistema del rol (no editable); hace falta para asignar sus permisos.
	systemId: string;
};

// "users:read;users:write" (o separado por coma, barra vertical o saltos de
// línea; también acepta un array en JSON) → [{resource, action}]. Devuelve un
// mensaje de error si algún elemento no tiene la forma recurso:acción.
function parsePermissions(
	value: unknown,
): PermissionSpec[] | { error: string } {
	const items = Array.isArray(value)
		? value.map((v) => String(v))
		: (cleanString(value)?.split(/[;|,\n]/) ?? []);
	const seen = new Set<string>();
	const specs: PermissionSpec[] = [];
	for (const item of items) {
		const token = item.trim();
		if (!token) continue;
		const idx = token.indexOf(":");
		const resource = token.slice(0, idx).trim();
		const action = token.slice(idx + 1).trim();
		if (idx < 1 || !action || resource.length > 100 || action.length > 100) {
			return {
				error: `Permisos: "${token}" no tiene la forma recurso:acción`,
			};
		}
		const key = `${resource}:${action}`;
		if (seen.has(key)) continue;
		seen.add(key);
		specs.push({ resource, action });
	}
	return specs;
}

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
	roleSystemById: Map<string, string>,
): ImportRowResult<RoleImportCreate, RoleImportUpdate>[] {
	return rawRows.map((row, index) => {
		const rowNumber = index + 1;
		const id = cleanString(row.id);
		const name = cleanString(row.name);
		const description = cleanString(row.description);
		const permissions = parsePermissions(row.permissions);
		if ("error" in permissions) {
			return { kind: "error", row: rowNumber, message: permissions.error };
		}

		if (id) {
			const systemId = roleSystemById.get(id);
			if (!systemId) {
				return {
					kind: "error",
					row: rowNumber,
					message: "No existe un rol con ese id (quita el id para crearlo)",
				};
			}
			const result = updateRoleSchema.safeParse({ name, description });
			if (!result.success) {
				return {
					kind: "error",
					row: rowNumber,
					message: describeZodError(result.error, FIELD_LABELS),
				};
			}
			return {
				kind: "update",
				row: rowNumber,
				id,
				input: { ...result.data, permissions, systemId },
			};
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
		return {
			kind: "create",
			row: rowNumber,
			input: { ...result.data, permissions },
		};
	});
}
