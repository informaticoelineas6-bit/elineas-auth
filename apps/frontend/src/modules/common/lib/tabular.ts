import type { ZodError } from "zod";

// Exportación/importación tabular (CSV, JSON y Excel) reutilizable por cualquier
// listado. Es la misma mecánica que usa la exportación de usuarios
// (employees/lib/import-export.ts), extraída aquí para roles y sistemas.
//
// `hucre/xlsx` solo hace falta cuando el usuario elige Excel (o sube un
// .xlsx/.xls): se carga con import() dinámico para que no entre en el bundle
// inicial. CSV y JSON son código nativo, sin dependencias.
const loadXlsx = () => import("hucre/xlsx");

export type ExportFormat = "csv" | "json" | "xlsx";

// Fila "cruda" de un archivo importado (claves/valores sin validar).
export type RawImportRow = Record<string, unknown>;

// Resultado de validar una fila importada. `C` y `U` son los payloads de alta y
// de edición de cada entidad.
export type ImportRowResult<C, U> =
	| { kind: "create"; row: number; input: C }
	| { kind: "update"; row: number; id: string; input: U }
	| { kind: "error"; row: number; message: string };

function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// Neutraliza la inyección de fórmulas: Excel/Sheets/LibreOffice evalúan como
// fórmula una celda que empieza por = + - @ (o tab/CR). Un valor editable por
// otro usuario podría ejecutarse al abrir el export (p. ej. =HYPERLINK(...) que
// filtra celdas vecinas). Se antepone una comilla simple, que la hoja no
// muestra. Los números legítimos (+53 5555 1234, -12) no se tocan.
const PLAIN_NUMBER = /^[+-]?[\d\s().-]+$/;
export function neutralizeFormula(value: string): string {
	if (!/^[=+\-@\t\r]/.test(value)) return value;
	return PLAIN_NUMBER.test(value) ? value : `'${value}`;
}

// Entrecomilla una celda solo si lo necesita y duplica las comillas internas,
// según RFC 4180.
function escapeCsvCell(raw: string): string {
	const value = neutralizeFormula(raw);
	return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv<C extends string>(
	rows: Record<C, string>[],
	columns: readonly C[],
): string {
	const header = columns.map(escapeCsvCell).join(",");
	const body = rows.map((row) =>
		columns.map((col) => escapeCsvCell(row[col] ?? "")).join(","),
	);
	return [header, ...body].join("\r\n");
}

// Parser CSV char-a-char: soporta campos entrecomillados con comas, saltos de
// línea y comillas escapadas (""). Devuelve la matriz de celdas cruda.
function parseCsvMatrix(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;
	let i = 0;

	while (i < text.length) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
				} else {
					inQuotes = false;
					i++;
				}
			} else {
				field += char;
				i++;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			i++;
		} else if (char === ",") {
			row.push(field);
			field = "";
			i++;
		} else if (char === "\r" || char === "\n") {
			row.push(field);
			field = "";
			rows.push(row);
			row = [];
			// \r\n cuenta como un solo salto de línea.
			i += char === "\r" && text[i + 1] === "\n" ? 2 : 1;
		} else {
			field += char;
			i++;
		}
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

// `hucre` devuelve las celdas con formato de fecha como Date y las vacías como
// null; se normalizan a "YYYY-MM-DD" y "" para que la fila tenga la misma forma
// venga de un CSV, un JSON o un Excel.
function normalizeCell(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return value ?? "";
}

// Matriz de celdas → filas objeto con la primera fila como cabecera. Salta las
// filas totalmente vacías.
function matrixToRows(matrix: unknown[][]): RawImportRow[] {
	const filled = matrix.filter((cells) =>
		cells.some((cell) => String(cell ?? "").trim() !== ""),
	);
	if (filled.length === 0) return [];
	const header = filled[0].map((key) => String(key ?? "").trim());
	return filled.slice(1).map((cells) => {
		const obj: RawImportRow = {};
		header.forEach((key, index) => {
			obj[key] = normalizeCell(cells[index]);
		});
		return obj;
	});
}

// Convierte las filas y dispara la descarga en el formato elegido. `filename`
// va sin extensión. `textColumns` fuerza formato texto en Excel (para que no
// quite ceros a la izquierda a códigos numéricos).
export async function exportTable<C extends string>({
	rows,
	columns,
	format,
	filename,
	sheetName,
	textColumns = [],
}: {
	rows: Record<C, string>[];
	columns: readonly C[];
	format: ExportFormat;
	filename: string;
	sheetName: string;
	textColumns?: readonly C[];
}) {
	if (format === "csv") {
		triggerDownload(
			new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8;" }),
			`${filename}.csv`,
		);
		return;
	}

	// El JSON no es una hoja de cálculo, así que va tal cual.
	if (format === "json") {
		triggerDownload(
			new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
			`${filename}.json`,
		);
		return;
	}

	const { writeXlsx } = await loadXlsx();
	const buffer = await writeXlsx({
		sheets: [
			{
				name: sheetName,
				columns: columns.map((col) => ({
					header: col,
					key: col,
					...(textColumns.includes(col) ? { numFmt: "@" } : {}),
				})),
				// Mismo saneado que el CSV: el .xlsx también se abre en Excel.
				data: rows.map((row) =>
					Object.fromEntries(
						Object.entries(row as Record<string, string>).map(([k, v]) => [
							k,
							typeof v === "string" ? neutralizeFormula(v) : v,
						]),
					),
				),
			},
		],
	});
	triggerDownload(
		// writeXlsx devuelve un Uint8Array<ArrayBufferLike>; el cast es seguro
		// porque hucre siempre escribe sobre un ArrayBuffer normal.
		new Blob([buffer as Uint8Array<ArrayBuffer>], {
			type: "application/octet-stream",
		}),
		`${filename}.xlsx`,
	);
}

// Detecta el formato por extensión y devuelve filas "crudas" (sin validar).
export async function parseTabularFile(file: File): Promise<RawImportRow[]> {
	const ext = file.name.split(".").pop()?.toLowerCase();

	if (ext === "json") {
		const data = JSON.parse(await file.text());
		if (!Array.isArray(data)) {
			throw new Error("El archivo JSON debe contener un array de filas.");
		}
		return data;
	}

	if (ext === "csv") {
		return matrixToRows(parseCsvMatrix((await file.text()).replace(/^﻿/, "")));
	}

	if (ext === "xlsx" || ext === "xls") {
		const { readXlsx, readXls } = await loadXlsx();
		const book = await (ext === "xls" ? readXls : readXlsx)(
			await file.arrayBuffer(),
			{ readStyles: true },
		);
		const sheet = book.sheets[0];
		if (!sheet) {
			throw new Error(`El archivo Excel (${file.name}) no tiene hojas.`);
		}
		return matrixToRows(sheet.rows);
	}

	throw new Error(
		`Formato de archivo no soportado (${file.name}). Usa CSV, JSON o Excel (.xlsx).`,
	);
}

// --- Utilidades de validación de filas importadas -------------------------

export function cleanString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	const str = String(value).trim();
	return str === "" ? undefined : str;
}

const TRUTHY = new Set(["true", "1", "sí", "si", "activo", "yes"]);

export function cleanBoolean(value: unknown): boolean | undefined {
	const str = cleanString(value);
	return str === undefined ? undefined : TRUTHY.has(str.toLowerCase());
}

// Convierte el primer issue de zod en un mensaje claro con el nombre del campo.
// Un `invalid_type` (los valores llegan como string o undefined) significa que la
// columna falta o está vacía → "es obligatorio".
export function describeZodError(
	error: ZodError,
	labels: Record<string, string>,
): string {
	const issue = error.issues[0];
	if (!issue) return "Datos inválidos";
	const field = issue.path[0];
	const label =
		typeof field === "string" ? (labels[field] ?? field) : undefined;
	const message =
		issue.code === "invalid_type" ? "es obligatorio" : issue.message;
	return label ? `${label}: ${message}` : message;
}
