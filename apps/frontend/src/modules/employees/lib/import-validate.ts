import type { ZodError } from "zod";
import { companyEmailSchema } from "#/modules/common/lib/validation.ts";
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
	| {
			kind: "create";
			row: number;
			input: CreateEmployeeInput;
			// Si viene, se crea también la cuenta de usuario con este correo.
			email?: string;
			// Ids de los roles a asignar a la cuenta (ver resolveImportRoles).
			roleIds?: string[];
	  }
	| {
			kind: "update";
			row: number;
			id: string;
			input: UpdateEmployeeInput;
			// Si viene, el empleado no tiene cuenta: se le crea y enlaza con este correo.
			email?: string;
			// Ids de los roles a asignar a la cuenta (ver resolveImportRoles).
			roleIds?: string[];
			// Cuenta ya enlazada al empleado (para asignarle roles sin crearla).
			userId?: string;
	  }
	| { kind: "error"; row: number; message: string };

// Valida y normaliza una fila "cruda" del archivo. Con `id` presente, la fila
// actualiza ese usuario existente; sin `id`, crea uno nuevo (y, si trae
// `email`, también su cuenta de acceso). `flagImportDuplicates` convierte luego
// en actualización las filas que ya existen (por CI, correo o nombre).
// Una actualización no modifica una cuenta existente; solo crea una si el
// empleado no tiene y la fila trae correo (ver flagImportDuplicates).
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
	const email = cleanString(row.email);
	if (email) {
		const parsed = companyEmailSchema.safeParse(email);
		if (!parsed.success) {
			return {
				kind: "error",
				row: index + 1,
				message: `Correo: ${parsed.error.issues[0]?.message ?? "no válido"}`,
			};
		}
	}
	return {
		kind: "create",
		row: index + 1,
		input: result.data,
		email: email?.toLowerCase(),
	};
}

// Empleado ya existente, reducido a lo que hace falta para detectar duplicados.
export type ExistingEmployee = {
	id: string;
	name: string;
	lastName: string;
	ci: string | null;
	userId?: string | null;
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

// Segunda pasada sobre las filas ya validadas. Las filas sin `id` que ya existen
// (mismo CI, correo o nombre completo, en ese orden de prioridad) pasan de crear
// a ACTUALIZAR ese empleado. Después marca como error las que chocarían con
// datos únicos: duplicados dentro del propio archivo (id/empleado, CI, email) y
// choques con OTRO empleado (CI, email, `id` inexistente).
// La primera aparición en el archivo se conserva; las siguientes son error.
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

	// Respaldo para filas sin CI ni id (caso típico de este import): se compara
	// por nombre completo.
	const nameOwner = new Map<string, string>();
	for (const e of existing) nameOwner.set(fullName(e.name, e.lastName), e.id);
	const seenNames = new Set<string>();

	const seenIds = new Set<string>();
	const seenCis = new Set<string>();
	const seenEmails = new Set<string>();

	return results.map((original, i) => {
		if (original.kind === "error") return original;
		let result: ImportRowResult = original;
		const rowMail = normEmail(raw[i]?.email);
		if (result.kind === "create") {
			const matchId =
				(result.input.ci ? ciOwner.get(result.input.ci) : undefined) ??
				(rowMail ? emailOwner.get(rowMail) : undefined) ??
				nameOwner.get(fullName(result.input.name, result.input.lastName));
			if (matchId) {
				result = {
					kind: "update",
					row: result.row,
					id: matchId,
					input: result.input,
				};
			}
		}
		const fail = (message: string): ImportRowResult => ({
			kind: "error",
			row: result.row,
			message,
		});
		const selfId = result.kind === "update" ? result.id : undefined;

		// Empleado existente SIN cuenta y fila con correo: se le creará la cuenta.
		if (result.kind === "update" && rowMail && !byId.get(result.id)?.user) {
			const parsed = companyEmailSchema.safeParse(rowMail);
			if (!parsed.success) {
				return fail(
					`Correo: ${parsed.error.issues[0]?.message ?? "no válido"}`,
				);
			}
			result = { ...result, email: rowMail };
		}

		if (selfId) {
			if (!byId.has(selfId)) {
				return fail(
					"No existe un empleado con ese id (quita el id para crearlo)",
				);
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
				return fail(
					`"${result.input.name} ${result.input.lastName}" repetido en el archivo`,
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

// ---------------------------------------------------------------------------
// Roles en la importación
// ---------------------------------------------------------------------------

// Texto crudo de las columnas de rol de una fila: `role` (o `roles`) con uno o
// varios nombres separados por ";" o "," y `system` con el slug del sistema.
function rawRoleNames(row: RawImportRow | undefined): string[] {
	const cell = cleanString(row?.role ?? row?.roles);
	if (!cell) return [];
	return cell
		.split(/[;,]/)
		.map((name) => name.trim())
		.filter(Boolean);
}

// ¿Alguna fila pide asignar un rol? Sirve para cargar el catálogo de roles solo
// cuando hace falta.
export function importHasRoles(raw: RawImportRow[]): boolean {
	return raw.some((row) => rawRoleNames(row).length > 0);
}

export type ImportRole = { id: string; name: string; systemId: string };
export type ImportSystem = { id: string; slug: string };

// Tercera pasada: traduce los nombres de rol de cada fila a ids del IS. Una fila
// con rol falla (y se omite entera, sin crear nada) si el rol no existe, es
// ambiguo (mismo nombre en varios sistemas y sin columna `system`) o no habrá
// cuenta a la que asignarlo (la fila no trae correo y el empleado no tiene
// cuenta). Así los errores salen en la vista previa, no a mitad de importación.
export function resolveImportRoles(
	results: ImportRowResult[],
	raw: RawImportRow[],
	roles: ImportRole[],
	systems: ImportSystem[],
	existing: ExistingEmployee[],
): ImportRowResult[] {
	const byId = new Map(existing.map((e) => [e.id, e]));
	const systemBySlug = new Map(systems.map((s) => [s.slug.toLowerCase(), s]));

	return results.map((result, i) => {
		if (result.kind === "error") return result;
		const names = rawRoleNames(raw[i]);
		if (names.length === 0) return result;

		const fail = (message: string): ImportRowResult => ({
			kind: "error",
			row: result.row,
			message,
		});

		const slug = cleanString(raw[i]?.system)?.toLowerCase();
		let systemId: string | undefined;
		if (slug) {
			const found = systemBySlug.get(slug);
			if (!found) return fail(`Sistema "${slug}" no existe`);
			systemId = found.id;
		}

		const roleIds: string[] = [];
		for (const name of names) {
			const matches = roles.filter(
				(role) =>
					role.name.toLowerCase() === name.toLowerCase() &&
					(!systemId || role.systemId === systemId),
			);
			if (matches.length === 0) {
				return fail(
					slug
						? `Rol "${name}" no existe en el sistema "${slug}"`
						: `Rol "${name}" no existe`,
				);
			}
			if (matches.length > 1) {
				return fail(
					`Rol "${name}" existe en varios sistemas: indica la columna system`,
				);
			}
			if (!roleIds.includes(matches[0].id)) roleIds.push(matches[0].id);
		}

		const userId =
			result.kind === "update" ? byId.get(result.id)?.userId : undefined;
		if (!result.email && !userId) {
			return fail(
				"Para asignar un rol hace falta correo (el usuario no tiene cuenta)",
			);
		}
		return { ...result, roleIds, ...(userId ? { userId } : {}) };
	});
}

// ---------------------------------------------------------------------------
// Departamentos en la importación
// ---------------------------------------------------------------------------

// Columna `departments`: nombres separados por ";" y "*" final para marcar al
// jefe ("Almacén*;Ventas"). Vacía = no tocar los departamentos de la persona.
function rawDepartmentItems(
	row: RawImportRow | undefined,
): { name: string; isHead: boolean }[] {
	const cell = cleanString(row?.departments ?? row?.departamentos);
	if (!cell) return [];
	return cell
		.split(";")
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => {
			const isHead = item.endsWith("*");
			return { name: (isHead ? item.slice(0, -1) : item).trim(), isHead };
		})
		.filter((item) => item.name.length > 0);
}

// ¿Alguna fila trae departamentos? Sirve para cargar el catálogo solo si hace falta.
export function importHasDepartments(raw: RawImportRow[]): boolean {
	return raw.some((row) => rawDepartmentItems(row).length > 0);
}

export type ImportDepartment = { id: string; name: string };

// Traduce los nombres de departamento de cada fila a ids y los deja en
// `input.departments` (el servidor reemplaza el conjunto de la persona). Una
// fila con un departamento inexistente se marca como error y no se importa.
// El "*" marca jefe explícito; sin "*" se omite `isHead` y decide el servidor
// (jefe solo si la persona es admin).
export function resolveImportDepartments(
	results: ImportRowResult[],
	raw: RawImportRow[],
	departments: ImportDepartment[],
): ImportRowResult[] {
	const byName = new Map(departments.map((d) => [d.name.toLowerCase(), d]));

	return results.map((result, i) => {
		if (result.kind === "error") return result;
		const items = rawDepartmentItems(raw[i]);
		if (items.length === 0) return result;

		const resolved: { departmentId: string; isHead?: boolean }[] = [];
		for (const item of items) {
			const found = byName.get(item.name.toLowerCase());
			if (!found) {
				return {
					kind: "error",
					row: result.row,
					message: `Departamento "${item.name}" no existe`,
				} satisfies ImportRowResult;
			}
			if (resolved.some((r) => r.departmentId === found.id)) continue;
			resolved.push({
				departmentId: found.id,
				...(item.isHead ? { isHead: true } : {}),
			});
		}
		return result.kind === "create"
			? { ...result, input: { ...result.input, departments: resolved } }
			: { ...result, input: { ...result.input, departments: resolved } };
	});
}
