import type { ZodError } from "zod";
import type {
	CreateEmployeeInput,
	UpdateEmployeeInput,
} from "../shared/types.ts";
import type { RawImportRow } from "./import-export.ts";
import { createEmployeeSchema, updateEmployeeSchema } from "./validation.ts";

// Validación/normalización de filas importadas, EN SU PROPIO módulo a propósito:
// `createEmployeeSchema`/`updateEmployeeSchema` arrastran `phoneSchema` →
// libphonenumber-js (~123 KB). El listado de usuarios monta `export-menu` →
// `import-export.ts`, así que si esta validación viviera allí, esos 123 KB
// entrarían en el bundle inicial de /employees aunque solo se usan al importar
// un archivo. El diálogo de importación carga este módulo con import() dinámico
// justo cuando el usuario elige el archivo (ver import-dialog.tsx).

function cleanString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	const str = String(value).trim();
	return str === "" ? undefined : str;
}

// El CI cubano son 11 dígitos. Al abrir el export en Excel/Sheets, una celda
// "01010112345" se interpreta como número y pierde los ceros a la izquierda; si
// llega como número, se rellena a 11 dígitos para recuperar el valor original.
function cleanCi(value: unknown): string | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value).padStart(11, "0");
	}
	return cleanString(value);
}

const TRUTHY = new Set(["true", "1", "sí", "si", "activo", "yes"]);

function cleanBoolean(value: unknown): boolean | undefined {
	const str = cleanString(value);
	return str === undefined ? undefined : TRUTHY.has(str.toLowerCase());
}

// Etiquetas legibles por campo para que el error diga QUÉ columna falla (p. ej.
// cuando las cabeceras del archivo no coinciden con los nombres esperados).
const FIELD_LABELS: Record<string, string> = {
	name: "Nombre",
	lastName: "Apellido",
	ci: "CI",
	birthday: "Fecha de nacimiento",
	phoneNumber: "Teléfono",
	address: "Dirección",
	inDate: "Fecha de alta",
	outDate: "Fecha de baja",
	active: "Activo",
};

// Convierte el primer issue de zod en un mensaje claro con el nombre del campo.
// Un `invalid_type` en este contexto (todos los valores llegan como string o
// undefined) significa que la columna falta o está vacía → "es obligatorio".
function describeError(error: ZodError): string {
	const issue = error.issues[0];
	if (!issue) return "Datos inválidos";
	const field = issue.path[0];
	const label =
		typeof field === "string" ? (FIELD_LABELS[field] ?? field) : undefined;
	const message =
		issue.code === "invalid_type" ? "es obligatorio" : issue.message;
	return label ? `${label}: ${message}` : message;
}

export type ImportRowResult =
	| { kind: "create"; row: number; input: CreateEmployeeInput }
	| { kind: "update"; row: number; id: string; input: UpdateEmployeeInput }
	| { kind: "error"; row: number; message: string };

// Valida y normaliza una fila "cruda" del archivo. Con `id` presente, la fila
// actualiza ese usuario existente; sin `id`, crea uno nuevo. No toca la
// cuenta de usuario (email/contraseña): ese enlace se gestiona aparte, desde
// "Nuevo usuario" o la ficha del empleado.
export function mapImportRow(
	row: RawImportRow,
	index: number,
): ImportRowResult {
	const id = cleanString(row.id);
	const payload = {
		name: cleanString(row.name),
		lastName: cleanString(row.lastName ?? row.lastname),
		ci: cleanCi(row.ci),
		birthday: cleanString(row.birthday),
		phoneNumber: cleanString(row.phoneNumber ?? row.phonenumber ?? row.phone),
		address: cleanString(row.address),
		inDate: cleanString(row.inDate ?? row.indate),
		outDate: cleanString(row.outDate ?? row.outdate),
		active: cleanBoolean(row.active),
	};

	if (id) {
		const result = updateEmployeeSchema.safeParse(payload);
		if (!result.success) {
			return {
				kind: "error",
				row: index + 1,
				message: describeError(result.error),
			};
		}
		return { kind: "update", row: index + 1, id, input: result.data };
	}

	const result = createEmployeeSchema.safeParse(payload);
	if (!result.success) {
		return {
			kind: "error",
			row: index + 1,
			message: describeError(result.error),
		};
	}
	return { kind: "create", row: index + 1, input: result.data };
}
