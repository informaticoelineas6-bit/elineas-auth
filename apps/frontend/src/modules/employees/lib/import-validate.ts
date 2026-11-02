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

// Empleado ya existente, reducido a lo que hace falta para detectar duplicados.
export type ExistingEmployee = {
	id: string;
	name: string;
	lastName: string;
	ci: string | null;
	user?: { email: string } | null;
};

// Nombre completo normalizado (sin tildes, mayúsculas ni espacios de más).
function fullName(name: string, lastName: string): string {
	return `${name} ${lastName}`
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

const normEmail = (value: unknown) => cleanString(value)?.toLowerCase();

// Segunda pasada sobre las filas ya validadas: marca como error las que
// duplicarían datos únicos, antes de tocar la API. Comprueba (a) duplicados
// dentro del propio archivo (id, CI, email) y (b) choques con los empleados
// existentes (CI, email, y que el `id` de una actualización exista de verdad).
// La primera aparición en el archivo se conserva; las siguientes son error.
// El email no se importa (no crea cuentas), pero si ya pertenece a otra
// persona delata un duplicado y se rechaza igualmente.
export function flagImportDuplicates(
	results: ImportRowResult[],
	raw: RawImportRow[],
	existing: ExistingEmployee[],
): ImportRowResult[] {
	const byId = new Map(existing.map((e) => [e.id, e]));
	const ciOwner = new Map<string, string>();
	const emailOwner = new Map<string, string>();
	for (const e of existing) {
		if (e.ci) ciOwner.set(e.ci, e.id);
		const mail = normEmail(e.user?.email);
		if (mail) emailOwner.set(mail, e.id);
	}

	// Respaldo para filas sin CI ni id (caso típico de este import): sin clave
	// única, reimportar el mismo archivo duplicaría a todos. Se compara por
	// nombre completo. Solo aplica a filas que CREAN; una actualización (con id)
	// ya identifica a su empleado.
	const nameOwner = new Map<string, string>();
	for (const e of existing) nameOwner.set(fullName(e.name, e.lastName), e.id);
	const seenNames = new Set<string>();

	const seenIds = new Set<string>();
	const seenCis = new Set<string>();
	const seenEmails = new Set<string>();

	return results.map((result, i) => {
		if (result.kind === "error") return result;
		const fail = (message: string): ImportRowResult => ({
			kind: "error",
			row: result.row,
			message,
		});
		const selfId = result.kind === "update" ? result.id : undefined;

		if (selfId) {
			if (!byId.has(selfId)) {
				return fail("No existe un empleado con ese id (quita el id para crearlo)");
			}
			if (seenIds.has(selfId)) return fail("id repetido en el archivo");
			seenIds.add(selfId);
		}

		const ci = result.input.ci;
		if (ci) {
			if (seenCis.has(ci)) return fail(`CI ${ci} repetido en el archivo`);
			const owner = ciOwner.get(ci);
			if (owner && owner !== selfId) {
				return fail(`Ya existe un empleado con el CI ${ci}`);
			}
			seenCis.add(ci);
		}

		if (result.kind === "create") {
			const key = fullName(result.input.name, result.input.lastName);
			if (seenNames.has(key)) {
				return fail(`"${result.input.name} ${result.input.lastName}" repetido en el archivo`);
			}
			if (nameOwner.has(key)) {
				return fail(
					`Ya existe un empleado llamado "${result.input.name} ${result.input.lastName}"`,
				);
			}
			seenNames.add(key);
		}

		const mail = normEmail(raw[i]?.email);
		if (mail) {
			if (seenEmails.has(mail)) {
				return fail(`Correo ${mail} repetido en el archivo`);
			}
			const owner = emailOwner.get(mail);
			if (owner && owner !== selfId) {
				return fail(`Ya existe un usuario con el correo ${mail}`);
			}
			seenEmails.add(mail);
		}
		return result;
	});
}
