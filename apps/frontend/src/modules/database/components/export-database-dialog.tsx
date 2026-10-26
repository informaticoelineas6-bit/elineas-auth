import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/modules/common/components/ui/dialog.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { PasswordInput } from "@/modules/common/components/ui/password-input.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
	reportRateLimited,
} from "@/modules/common/lib/errors.ts";
import { useCountdown } from "@/modules/common/lib/use-countdown.ts";
import { exportDatabaseFn } from "../actions/database.ts";

// Descarga el texto como archivo desde el navegador, sin pasar por ninguna URL.
function downloadSql(filename: string, sql: string) {
	const url = URL.createObjectURL(
		new Blob([sql], { type: "application/sql;charset=utf-8" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

// Exporta la base de datos como script SQL en el momento del clic. Solo admin
// (el ítem del menú solo se muestra a admins y el IS lo vuelve a exigir). Pide
// la contraseña del admin: el archivo entrega toda la información de personas
// del IS, así que una sesión robada no debería bastar.
export function ExportDatabaseDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const exportDatabase = useServerFn(exportDatabaseFn);
	const [password, setPassword] = useState("");
	const [passwordError, setPasswordError] = useState<string | undefined>();
	const rateLimit = useCountdown();

	function close(next: boolean) {
		// Son credenciales, no un borrador: se descartan al cerrar.
		if (!next) {
			setPassword("");
			setPasswordError(undefined);
		}
		onOpenChange(next);
	}

	const mutation = useMutation({
		mutationFn: () => exportDatabase({ data: { currentPassword: password } }),
		onSuccess: (dump) => {
			downloadSql(dump.filename, dump.sql);
			toast.success("Base de datos exportada", {
				description: `${dump.tables} tablas en ${dump.filename}.`,
			});
			close(false);
		},
		onError: (error) => {
			const status = getErrorStatus(error);
			if (status === 401) {
				// Re-autenticación fallida: TU contraseña de admin no es correcta.
				setPasswordError(
					getErrorMessage(error, "Tu contraseña no es correcta."),
				);
			} else if (status === 403) {
				toast.error(getErrorMessage(error));
			} else if (status === 429) {
				reportRateLimited(error, rateLimit.start);
			} else {
				reportError(error, "No se pudo exportar la base de datos.");
			}
		},
	});

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Exportar base de datos</DialogTitle>
					<DialogDescription>
						Descarga un script SQL con el esquema y los datos actuales de todas
						las tablas. No incluye secretos: sin sesiones, tokens, claves de
						firma, y sin los hashes de contraseña. Aun
						así contiene datos personales: guárdalo con cuidado.
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						setPasswordError(undefined);
						mutation.mutate();
					}}
					className="space-y-6"
				>
					<Field data-invalid={Boolean(passwordError)}>
						<FieldLabel htmlFor="export-current-password" required>
							Tu contraseña
						</FieldLabel>
						<PasswordInput
							id="export-current-password"
							value={password}
							onChange={(e) => {
								setPasswordError(undefined);
								setPassword(e.target.value);
							}}
							aria-invalid={Boolean(passwordError)}
							autoComplete="current-password"
						/>
						<FieldDescription>
							Confirma que eres quien dice ser antes de una acción sensible.
						</FieldDescription>
						{passwordError && <FieldError>{passwordError}</FieldError>}
					</Field>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => close(false)}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={!password || mutation.isPending || rateLimit.active}
						>
							<LoadingSwap isLoading={mutation.isPending}>
								{rateLimit.active
									? `Espera ${rateLimit.remaining}s`
									: "Exportar SQL"}
							</LoadingSwap>
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
