import { AlertTriangle, CheckCircle2, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/modules/common/components/ui/dialog.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { Spinner } from "@/modules/common/components/ui/spinner.tsx";
import {
	getErrorMessage,
	getErrorStatus,
} from "@/modules/common/lib/errors.ts";
import { parseEmployeeFile } from "@/modules/employees/lib/import-export.ts";
import type { ImportRowResult } from "@/modules/employees/lib/import-validate.ts";
import {
	useCreateEmployee,
	useCreateEmployeeAccount,
	useCreateEmployeeWithUser,
	useExportEmployees,
	useUpdateEmployee,
} from "@/modules/employees/queries/employees.ts";
import { useExportRoles } from "@/modules/roles/queries/roles.ts";
import { useExportSystems } from "@/modules/systems/queries/systems.ts";
import { useCreateUserRole } from "@/modules/user-roles/queries/user-roles.ts";

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
	const createWithUser = useCreateEmployeeWithUser();
	const createAccount = useCreateEmployeeAccount();
	const updateEmployee = useUpdateEmployee();
	const loadExisting = useExportEmployees();
	const loadRoles = useExportRoles();
	const loadSystems = useExportSystems();
	const createUserRole = useCreateUserRole();

	const [parsing, setParsing] = useState(false);
	const [parseError, setParseError] = useState<string | undefined>();
	const [rows, setRows] = useState<ImportRowResult[] | null>(null);
	// Por defecto NO se envían invitaciones: las cuentas se crean y se invita
	// después (evita una ráfaga de correos en importaciones grandes).
	const [sendInvites, setSendInvites] = useState(false);
	const [importing, setImporting] = useState(false);
	const [progress, setProgress] = useState(0);
	const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);

	function reset() {
		setSendInvites(false);
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
			// La validación (zod → libphonenumber) se carga bajo demanda aquí, no
			// en el bundle del listado (ver import-validate.ts).
			// Se traen también los empleados existentes para detectar duplicados
			// (CI, correo, ids inexistentes) ANTES de enviar nada.
			const [
				raw,
				{ mapImportRow, flagImportDuplicates, importHasRoles, resolveImportRoles },
				existing,
			] = await Promise.all([
				parseEmployeeFile(file),
				import("../lib/import-validate.ts"),
				loadExisting.mutateAsync({}),
			]);
			let validated = flagImportDuplicates(
				raw.map((row, index) => mapImportRow(row, index)),
				raw,
				existing,
			);
			// El catálogo de roles/sistemas solo se pide si el archivo asigna roles.
			if (importHasRoles(raw)) {
				const [roles, systems] = await Promise.all([
					loadRoles.mutateAsync({}),
					loadSystems.mutateAsync({}),
				]);
				validated = resolveImportRoles(
					validated,
					raw,
					roles,
					systems,
					existing,
				);
			}
			setRows(validated);
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
		// Asigna los roles de la fila a la cuenta. Un 409 ("ya tiene ese rol") no es
		// un fallo: el resultado buscado ya está. Devuelve cuántos se asignaron.
		async function assignRoles(userId: string, roleIds: string[]) {
			let assigned = 0;
			for (const roleId of roleIds) {
				try {
					await createUserRole.mutateAsync({ userId, roleId });
					assigned++;
				} catch (error) {
					if (getErrorStatus(error) !== 409) throw error;
				}
			}
			return assigned;
		}

		// Texto para el resultado de la fila. Si falla la asignación, se relanza con
		// contexto: la fila ya está creada/actualizada y así se ve en el error.
		async function roleSuffix(userId: string, roleIds?: string[]) {
			if (!roleIds || roleIds.length === 0) return "";
			try {
				const assigned = await assignRoles(userId, roleIds);
				return assigned > 0
					? ` · ${assigned} rol(es) asignado(s)`
					: " · ya tenía los roles";
			} catch (error) {
				throw new Error(
					`Guardado, pero no se pudo asignar el rol: ${getErrorMessage(error)}`,
				);
			}
		}

		for (const result of rows) {
			if (result.kind === "error") {
				results.push({
					row: result.row,
					label: result.message,
					status: "error",
				});
				setProgress((p) => p + 1);
				continue;
			}
			try {
				if (result.kind === "create") {
					if (result.email) {
						// Crea la cuenta y envía la invitación para fijar la contraseña.
						const { userId: _userId, ...employeeInput } = result.input;
						const created = await createWithUser.mutateAsync({
							user: {
								name: `${result.input.name} ${result.input.lastName}`.slice(
									0,
									100,
								),
								email: result.email,
							},
							employee: employeeInput,
							sendInvite: sendInvites,
						});
						const roleNote = await roleSuffix(created.user.id, result.roleIds);
						results.push({
							row: result.row,
							label:
								(sendInvites
									? "Creado con cuenta (invitación en cola)"
									: "Creado con cuenta") + roleNote,
							status: "ok",
						});
					} else {
						await createEmployee.mutateAsync(result.input);
						results.push({ row: result.row, label: "Creado", status: "ok" });
					}
				} else {
					await updateEmployee.mutateAsync({
						id: result.id,
						input: result.input,
					});
					// Empleado existente sin cuenta y con correo en la fila: se crea y
					// enlaza la cuenta. Si falla, la fila sale como error (los datos
					// del empleado ya quedaron actualizados).
					let userId = result.userId;
					if (result.email) {
						const account = await createAccount.mutateAsync({
							id: result.id,
							email: result.email,
							sendInvite: sendInvites,
						});
						userId = account.user.id;
					}
					const roleNote = userId
						? await roleSuffix(userId, result.roleIds)
						: "";
					results.push({
						row: result.row,
						label:
							(result.email
								? sendInvites
									? "Actualizado y cuenta creada (invitación en cola)"
									: "Actualizado y cuenta creada"
								: "Actualizado") + roleNote,
						status: "ok",
					});
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
	const toCreateWithAccount =
		rows?.filter((r) => r.kind !== "error" && r.email).length ?? 0;
	const toUpdate = rows?.filter((r) => r.kind === "update").length ?? 0;
	const toAssignRoles =
		rows?.filter((r) => r.kind !== "error" && r.roleIds?.length).length ?? 0;
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
						Sube un archivo CSV, JSON o Excel con nombre y apellido (el resto es
						opcional). Si la fila trae <code>id</code>, o coincide con un
						usuario existente (CI, correo o nombre completo), lo actualiza; si
						no, crea uno nuevo. Si trae <code>email</code>, también se crea la
						cuenta (en usuarios nuevos y en existentes que aún no tengan una);
						la invitación por correo es opcional, tras la vista previa. Una
						cuenta que ya existe no se modifica. Para asignar roles añade la
						columna <code>role</code> (uno o varios nombres separados por «;»)
						y, si el nombre se repite en varios sistemas, <code>system</code>{" "}
						(slug); el usuario necesita cuenta (columna <code>email</code>).
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

						{toAssignRoles > 0 && (
							<p className="text-sm text-muted-foreground">
								Se asignarán roles a {toAssignRoles} usuario(s).
							</p>
						)}

						{toCreateWithAccount > 0 && (
							<label className="flex items-start gap-2 text-sm">
								<Checkbox
									checked={sendInvites}
									disabled={importing}
									onCheckedChange={(v) => setSendInvites(v === true)}
									className="mt-0.5"
								/>
								<span>
									Enviar invitación por correo a las {toCreateWithAccount}{" "}
									cuenta(s) a crear. Se envían una a una, con pausa. Si no, se
									crean sin correo y puedes invitarlas después.
								</span>
							</label>
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
									<LoadingSwap
										isLoading={importing}
										className="flex items-center justify-center gap-2"
									>
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
