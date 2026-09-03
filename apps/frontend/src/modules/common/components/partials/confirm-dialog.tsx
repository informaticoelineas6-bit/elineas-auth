import type * as React from "react";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/modules/common/components/ui/alert-dialog.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Spinner } from "@/modules/common/components/ui/spinner.tsx";

// Diálogo de confirmación controlado para acciones destructivas o irreversibles
// (eliminar, desactivar, revocar…). El padre controla `open` y ejecuta la
// mutación en `onConfirm`; mientras `loading` sea true el diálogo no se cierra.
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "Confirmar",
	cancelLabel = "Cancelar",
	destructive = false,
	loading = false,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: React.ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	loading?: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				// No permitir cerrar mientras la acción está en curso.
				if (loading) return;
				onOpenChange(next);
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description && (
						<AlertDialogDescription>{description}</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>
						{cancelLabel}
					</AlertDialogCancel>
					{/* Botón propio (no AlertDialogAction) para no cerrar en el click:
					    el diálogo se cierra cuando el padre pone `open` a false tras el éxito. */}
					<Button
						variant={destructive ? "destructive" : "default"}
						disabled={loading}
						onClick={onConfirm}
					>
						{loading && <Spinner />}
						{confirmLabel}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
