import type { Employee } from "../shared/types.ts";

// `hucre/xlsx` solo hace falta cuando el usuario elige el formato Excel (o sube
// un .xlsx/.xls). Se carga con import() dinámico para que NO entre en el bundle
// inicial de la ruta de usuarios; CSV y JSON se manejan con código nativo (sin
// dependencias). Se importa el subpath `hucre/xlsx` (no la raíz `hucre`) para
// no arrastrar los lectores/escritores de ODS, XML y CSV del paquete.
const loadXlsx = () => import("hucre/xlsx");

// Columnas del CSV/JSON/Excel de exportación e importación. `id` y `email`
// son informativos: `email` es de solo lectura (viene de la cuenta de
// usuario enlazada, si existe, y se ignora al importar — este flujo no crea
// ni enlaza cuentas de usuario); `id`, si viene informado en la importación,
// hace que la fila actualice ese usuario en vez de crear uno nuevo.
export const EMPLOYEE_EXPORT_COLUMNS = [
	"id",
	"name",
	"lastName",
	"ci",
	"birthday",
	"phoneNumber",
	"address",
	"inDate",
	"outDate",
	"active",
	"email",
] as const;

type EmployeeExportRow = Record<
	(typeof EMPLOYEE_EXPORT_COLUMNS)[number],
	string
>;

// El IS devuelve las fechas como datetime ISO completo; se recorta a
// "YYYY-MM-DD" (mismo formato que <input type="date"> y que toDateInputValue
// en lib/form.ts) para que la fila sea legible en una hoja de cálculo y
// reimportable sin sorpresas.
function toDateCell(value: string | null): string {
	return value ? value.slice(0, 10) : "";
}

function employeeToRow(employee: Employee): EmployeeExportRow {
	return {
		id: employee.id,
		name: employee.name,
		lastName: employee.lastName,
		ci: employee.ci ?? "",
		birthday: toDateCell(employee.birthday),
		phoneNumber: employee.phoneNumber ?? "",
		address: employee.address ?? "",
		inDate: toDateCell(employee.inDate),
		outDate: toDateCell(employee.outDate),
		active: String(employee.active),
		email: employee.user?.email ?? "",
	};
}

function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// --- CSV nativo (RFC 4180) -------------------------------------------------
// Reemplaza a papaparse para nuestro caso acotado (una tabla plana de strings).

// Entrecomilla una celda solo si lo necesita (contiene coma, comilla o salto
// de línea) y duplica las comillas internas, según RFC 4180.
function escapeCsvCell(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(
	rows: EmployeeExportRow[],
	columns: readonly (keyof EmployeeExportRow)[],
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
	// Última celda/fila si el texto no termina en salto de línea.
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

// Normaliza una celda cruda antes de validarla. `hucre` devuelve las celdas con
// formato de fecha como Date (epoch UTC, ver serialToDate) y las vacías como
// null; se convierten a "YYYY-MM-DD" y "" para que la fila llegue a
// import-validate.ts con la misma forma que viene de un CSV o un JSON. Los
// números se dejan tal cual: cleanCi los rellena a 11 dígitos.
function normalizeCell(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return value ?? "";
}

// Matriz de celdas → filas objeto con la primera fila como cabecera. La usan el
// CSV y el Excel (las hojas de `hucre` son también matrices de celdas). Salta
// las filas totalmente vacías (equivalente a `skipEmptyLines` de papaparse).
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

// Quita el BOM que Excel suele anteponer y delega en matrixToRows.
function csvToRows(text: string): RawImportRow[] {
	return matrixToRows(parseCsvMatrix(text.replace(/^\uFEFF/, "")));
}

export type ExportFormat = "csv" | "json" | "xlsx";

// Convierte y dispara la descarga en el navegador. CSV y JSON son nativos;
// Excel carga `hucre/xlsx` bajo demanda (import dinámico), así que solo quien
// elige Excel paga ese peso. El servidor solo aporta el array completo de
// empleados (ver listAllEmployeesFn). Es async por el import() de hucre.
export async function exportEmployees(
	employees: Employee[],
	format: ExportFormat,
) {
	const rows = employees.map(employeeToRow);
	const columns = [...EMPLOYEE_EXPORT_COLUMNS];

	if (format === "csv") {
		triggerDownload(
			new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8;" }),
			"usuarios.csv",
		);
		return;
	}

	if (format === "json") {
		triggerDownload(
			new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
			"usuarios.json",
		);
		return;
	}

	const { writeXlsx } = await loadXlsx();
	// CI y teléfono son cadenas de dígitos: sin marcarlas como texto, Excel las
	// interpreta como número al abrir el archivo y les quita los ceros a la
	// izquierda (un CI "01…" pasa a 10 dígitos). El formato de texto ("@") de la
	// columna evita esa corrupción al reimportar.
	const TEXT_COLUMNS: (keyof EmployeeExportRow)[] = ["ci", "phoneNumber"];
	const buffer = await writeXlsx({
		sheets: [
			{
				name: "Usuarios",
				// `header` es el texto de la cabecera y `key` la propiedad de la que
				// sale el valor en cada fila de `data`: ambas son el nombre de la
				// columna, así que el orden de EMPLOYEE_EXPORT_COLUMNS se respeta.
				columns: columns.map((col) => ({
					header: col,
					key: col,
					...(TEXT_COLUMNS.includes(col) ? { numFmt: "@" } : {}),
				})),
				data: rows,
			},
		],
	});
	triggerDownload(
		// El Uint8Array<ArrayBufferLike> que devuelve writeXlsx no encaja en el tipo
		// BlobPart (exige ArrayBuffer, no SharedArrayBuffer); el cast es seguro
		// porque hucre siempre escribe sobre un ArrayBuffer normal.
		new Blob([buffer as Uint8Array<ArrayBuffer>], {
			type: "application/octet-stream",
		}),
		"usuarios.xlsx",
	);
}

// --- Importación -----------------------------------------------------------

// Fila "cruda" del archivo (claves/valores sin validar). La validación vive en
// import-validate.ts (cargado con import() dinámico) para no arrastrar los
// schemas —y con ellos libphonenumber— al bundle del listado.
export type RawImportRow = Record<string, unknown>;

// Detecta el formato por extensión y devuelve filas "crudas" (claves y
// valores tal cual vienen del archivo, sin validar todavía).
export async function parseEmployeeFile(file: File): Promise<RawImportRow[]> {
	const ext = file.name.split(".").pop()?.toLowerCase();

	if (ext === "json") {
		const data = JSON.parse(await file.text());
		if (!Array.isArray(data)) {
			throw new Error("El archivo JSON debe contener un array de filas.");
		}
		return data;
	}

	if (ext === "csv") {
		return csvToRows(await file.text());
	}

	if (ext === "xlsx" || ext === "xls") {
		const { readXlsx, readXls } = await loadXlsx();
		// `readStyles: true` es lo que permite a hucre distinguir una celda con
		// formato de fecha de un número cualquiera: sin él, un birthday guardado
		// como fecha llegaría como número de serie de Excel (45000) en vez de Date.
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
