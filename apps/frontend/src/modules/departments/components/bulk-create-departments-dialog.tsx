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
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { Textarea } from "@/modules/common/components/ui/textarea.tsx";
import { getErrorStatus, reportError } from "@/modules/common/lib/errors.ts";
import { useBulkCreateDepartments } from "../queries/departments.ts";

const MAX = 100;

// Un nombre por línea; recorta, descarta vacías y repetidas (sin distinguir
// mayúsculas), conservando el orden.
export function parseNames(text: string): string[] {
	const seen = new Set<string>();
	const names: string[] = [];
	for (const line of text.split("\n")) {
		const name = line.trim();
		const key = name.toLowerCase();
		if (!name || seen.has(key)) continue;
		seen.add(key);
		names.push(name);
	}
	return names;
}

// Diálogo "Crear varios departamentos": un nombre por línea → N departamentos.
export function BulkCreateDepartmentsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Crear varios departamentos</DialogTitle>
					<DialogDescription>
						Escribe un nombre por línea. Los que ya existan se omiten.
					</DialogDescription>
				</DialogHeader>
				{/* Se monta solo abierto para reiniciar el estado en cada apertura. */}
				{open && <BulkCreateForm onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function BulkCreateForm({ onDone }: { onDone: () => void }) {
	const bulkCreate = useBulkCreateDepartments();
	const [text, setText] = useState("");
	const names = parseNames(text);
	const tooLong = names.find((name) => name.length > 100);
	const tooMany = names.length > MAX;
	const canSubmit =
		names.length > 0 && !tooLong && !tooMany && !bulkCreate.isPending;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		try {
			const { created, skipped } = await bulkCreate.mutateAsync({
				departments: names.map((name) => ({ name })),
			});
			if (created.length > 0) {
				toast.success(
					created.length === 1
						? "1 departamento creado"
						: `${created.length} departamentos creados`,
				);
			}
			if (skipped.length > 0) {
				toast.info(`${skipped.length} nombre(s) ya existían y se omitieron`, {
					description: skipped.join(", "),
				});
			}
			onDone();
		} catch (error) {
			if (getErrorStatus(error) === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(error, "No se pudieron crear los departamentos.");
			}
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<Field data-invalid={Boolean(tooLong) || tooMany}>
				<div className="flex items-center justify-between">
					<FieldLabel htmlFor="bulk-departments" required>
						Nombres
					</FieldLabel>
					<span className="text-xs text-muted-foreground">
						{names.length} departamento(s)
					</span>
				</div>
				<Textarea
					id="bulk-departments"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={"Almacén central\nVentas\nCompras"}
					rows={8}
					autoFocus
				/>
				<FieldDescription>
					Máximo {MAX} por vez y 100 caracteres cada uno.
				</FieldDescription>
				{tooMany && (
					<p className="text-sm text-destructive">
						Demasiados nombres: el máximo es {MAX}.
					</p>
				)}
				{tooLong && (
					<p className="text-sm text-destructive">
						Un nombre supera los 100 caracteres.
					</p>
				)}
			</Field>

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Cancelar
				</Button>
				<Button type="submit" disabled={!canSubmit}>
					<LoadingSwap isLoading={bulkCreate.isPending}>
						Crear{names.length > 0 ? ` ${names.length}` : ""}
					</LoadingSwap>
				</Button>
			</DialogFooter>
		</form>
	);
}
