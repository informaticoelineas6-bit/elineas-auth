import {
	AlertTriangle,
	CheckCircle2,
	Upload,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/modules/common/components/ui/dialog.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { Spinner } from "@/modules/common/components/ui/spinner.tsx";
import { getErrorMessage } from "@/modules/common/lib/errors.ts";
import {
	type ImportRowResult,
	mapImportRow,
	parseEmployeeFile,
} from "@/modules/employees/lib/import-export.ts";
import {
	useCreateEmployee,
	useUpdateEmployee,
} from "@/modules/employees/queries/employees.ts";

type RowOutcome = { row: number; label: string; status: "ok" | "error" };

// Diálogo de importación: parsea el archivo → valida cada fila (zod, mismas
// reglas que el alta/edición) → muestra un resumen antes de tocar la API →
// procesa fila por fila (secuencial, para reportar progreso y no saturar al
// IS) → resultado final con qué filas fallaron y por qué. No crea ni enlaza
// cuentas de usuario: solo datos de empleado (ver import-export.ts).
export function ImportDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const createEmployee = useCreateEmployee();
	const updateEmployee = useUpdateEmployee();

	const [parsing, setParsing] = useState(false);
	const [parseError, setParseError] = useState<string | undefined>();
	const [rows, setRows] = useState<ImportRowResult[] | null>(null);
	const [importing, setImporting] = useState(false);
	const [progress, setProgress] = useState(0);
	const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);

	function reset() {
		setParsing(false);
		setParseError(undefined);
		setRows(null);
		setImporting(false);
		setProgress(0);
		setOutcomes(null);
	}

	async function handleFile(file: File | undefined) {
		if (!file) return;
		setParseError(undefined);
		setRows(null);
		setOutcomes(null);
		setParsing(true);
		try {
			const raw = await parseEmployeeFile(file);
			setRows(raw.map((row, index) => mapImportRow(row, index)));
		} catch (error) {
			setParseError(getErrorMessage(error, "No se pudo leer el archivo."));
		} finally {
			setParsing(false);
		}
	}

	async function runImport() {
		if (!rows) return;
		setImporting(true);
		setProgress(0);
		const results: RowOutcome[] = [];

		// Secuencial a propósito: reporta progreso fila a fila y no dispara
		// decenas de peticiones concurrentes contra el IS.
		for (const result of rows) {
			if (result.kind === "error") {
				results.push({ row: result.row, label: result.message, status: "error" });
				setProgress((p) => p + 1);
				continue;
			}
			try {
				if (result.kind === "create") {
					await createEmployee.mutateAsync(result.input);
					results.push({ row: result.row, label: "Creado", status: "ok" });
				} else {
					await updateEmployee.mutateAsync({ id: result.id, input: result.input });
					results.push({ row: result.row, label: "Actualizado", status: "ok" });
				}
			} catch (error) {
				results.push({
					row: result.row,
					label: getErrorMessage(error, "No se pudo guardar"),
					status: "error",
				});
			}
			setProgress((p) => p + 1);
		}

		setOutcomes(results);
		setImporting(false);
	}

	const toCreate = rows?.filter((r) => r.kind === "create").length ?? 0;
	const toUpdate = rows?.filter((r) => r.kind === "update").length ?? 0;
	const invalid = rows?.filter((r) => r.kind === "error") ?? [];
	const okCount = outcomes?.filter((o) => o.status === "ok").length ?? 0;
	const failCount = outcomes?.filter((o) => o.status === "error").length ?? 0;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (importing) return;
				if (!next) reset();
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Importar usuarios</DialogTitle>
					<DialogDescription>
						Sube un archivo CSV, JSON o Excel con los datos de empleado
						(nombre, apellido, CI…). Si una fila trae <code>id</code>,
						actualiza ese usuario; si no, crea uno nuevo. No crea cuentas de
						acceso (email/contraseña): eso se gestiona desde "Nuevo usuario".
					</DialogDescription>
				</DialogHeader>

				{!rows && !outcomes && (
					<div className="space-y-3">
						<input
							type="file"
							accept=".csv,.json,.xlsx,.xls"
							disabled={parsing}
							onChange={(e) => handleFile(e.target.files?.[0])}
							className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
						/>
						{parsing && (
							<p className="flex items-center gap-2 text-sm text-muted-foreground">
								<Spinner className="size-4" /> Leyendo archivo…
							</p>
						)}
						{parseError && (
							<p className="text-sm text-destructive">{parseError}</p>
						)}
					</div>
				)}

				{rows && !outcomes && (
					<div className="space-y-3">
						<div className="flex flex-wrap gap-4 text-sm">
							<span className="flex items-center gap-1.5 text-foreground">
								<CheckCircle2 className="size-4 text-primary" />
								{toCreate} para crear
							</span>
							<span className="flex items-center gap-1.5 text-foreground">
								<CheckCircle2 className="size-4 text-primary" />
								{toUpdate} para actualizar
							</span>
							{invalid.length > 0 && (
								<span className="flex items-center gap-1.5 text-destructive">
									<AlertTriangle className="size-4" />
									{invalid.length} con error (se omitirán)
								</span>
							)}
						</div>

						{invalid.length > 0 && (
							<div className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
								{invalid.slice(0, 20).map((row) => (
									<p key={row.row}>
										Fila {row.row}: {"message" in row ? row.message : ""}
									</p>
								))}
								{invalid.length > 20 && (
									<p>… y {invalid.length - 20} fila(s) más.</p>
								)}
							</div>
						)}

						{importing && (
							<p className="flex items-center gap-2 text-sm text-muted-foreground">
								<Spinner className="size-4" />
								Procesando {progress}/{rows.length}…
							</p>
						)}
					</div>
				)}

				{outcomes && (
					<div className="space-y-3">
						<div className="flex flex-wrap gap-4 text-sm">
							<span className="flex items-center gap-1.5 text-foreground">
								<CheckCircle2 className="size-4 text-primary" />
								{okCount} aplicada(s)
							</span>
							{failCount > 0 && (
								<span className="flex items-center gap-1.5 text-destructive">
									<XCircle className="size-4" />
									{failCount} con error
								</span>
							)}
						</div>
						<div className="max-h-52 overflow-y-auto rounded-md border bg-muted/40 p-2 text-xs">
							{outcomes.map((outcome) => (
								<p
									key={outcome.row}
									className={
										outcome.status === "error"
											? "text-destructive"
											: "text-muted-foreground"
									}
								>
									Fila {outcome.row}: {outcome.label}
								</p>
							))}
						</div>
					</div>
				)}

				<DialogFooter>
					{outcomes ? (
						<Button
							onClick={() => {
								reset();
								onOpenChange(false);
							}}
						>
							Cerrar
						</Button>
					) : (
						<>
							<Button
								variant="outline"
								disabled={importing}
								onClick={() => {
									reset();
									onOpenChange(false);
								}}
							>
								Cancelar
							</Button>
							{rows && (
								<Button
									disabled={importing || toCreate + toUpdate === 0}
									onClick={runImport}
								>
									<LoadingSwap isLoading={importing}>
										<Upload />
										Importar {toCreate + toUpdate} fila(s)
									</LoadingSwap>
								</Button>
							)}
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
