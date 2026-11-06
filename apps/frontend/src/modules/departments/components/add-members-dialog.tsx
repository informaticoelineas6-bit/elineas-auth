import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";
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
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { getErrorStatus, reportError } from "@/modules/common/lib/errors.ts";
import { useUserDirectory } from "@/modules/user-roles/lib/use-user-directory.ts";
import { useAddDepartmentMembers } from "../queries/departments.ts";

// Diálogo "Agregar usuarios": N usuarios → un departamento. Quien aún no tiene
// ficha de empleado la recibe en el servidor; quien ya es miembro se omite.
export function AddMembersDialog({
	departmentId,
	departmentName,
	open,
	onOpenChange,
}: {
	departmentId: string;
	departmentName: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Agregar usuarios a "{departmentName}"</DialogTitle>
					<DialogDescription>
						Elige los usuarios que se agregarán. Quienes ya pertenecen se
						omiten.
					</DialogDescription>
				</DialogHeader>
				{open && (
					<AddMembersForm
						departmentId={departmentId}
						onDone={() => onOpenChange(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function AddMembersForm({
	departmentId,
	onDone,
}: {
	departmentId: string;
	onDone: () => void;
}) {
	const addMembers = useAddDepartmentMembers();
	const directory = useUserDirectory({ limit: 100 });
	const { search, setSearch } = directory;
	const [userIds, setUserIds] = useState<string[]>([]);
	const [makeHead, setMakeHead] = useState(false);

	const users = directory.users.map((user) => ({
		id: user.id,
		name: user.employeeName ?? user.name,
		email: user.email,
	}));
	const allVisibleSelected =
		users.length > 0 && users.every((user) => userIds.includes(user.id));

	function toggleUser(id: string, checked: boolean) {
		setUserIds((prev) =>
			checked ? [...prev, id] : prev.filter((userId) => userId !== id),
		);
	}

	function toggleAllVisible(checked: boolean) {
		const visible = new Set(users.map((user) => user.id));
		setUserIds((prev) => {
			const rest = prev.filter((id) => !visible.has(id));
			return checked ? [...rest, ...visible] : rest;
		});
	}

	const canSubmit = userIds.length > 0 && !addMembers.isPending;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		try {
			const { added, skipped } = await addMembers.mutateAsync({
				id: departmentId,
				// Sin marcar, se omite y el servidor decide (admin ⇒ jefe).
				input: { userIds, ...(makeHead ? { isDepartmentHead: true } : {}) },
			});
			if (added.length > 0) {
				toast.success(
					added.length === 1
						? "1 usuario agregado"
						: `${added.length} usuarios agregados`,
				);
			}
			if (skipped.length > 0) {
				const names = skipped.map((id) => {
					const user = directory.lookup(id);
					return user ? (user.employeeName ?? user.name) : id;
				});
				toast.info(`${skipped.length} usuario(s) ya eran miembros`, {
					description: names.join(", "),
				});
			}
			onDone();
		} catch (error) {
			if (getErrorStatus(error) === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(error, "No se pudieron agregar los usuarios.");
			}
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<Field>
				<div className="flex items-center justify-between">
					<FieldLabel required>Usuarios</FieldLabel>
					<span className="text-xs text-muted-foreground">
						{userIds.length} seleccionado(s)
					</span>
				</div>
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Buscar por nombre o email…"
				/>
				<div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
					{directory.isPending ? (
						<p className="px-2 py-4 text-center text-sm text-muted-foreground">
							Cargando usuarios…
						</p>
					) : users.length === 0 ? (
						<p className="px-2 py-4 text-center text-sm text-muted-foreground">
							Sin usuarios con cuenta
						</p>
					) : (
						<>
							<label
								htmlFor="members-all"
								className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover:bg-accent"
							>
								<Checkbox
									id="members-all"
									checked={allVisibleSelected}
									onCheckedChange={(checked) =>
										toggleAllVisible(checked === true)
									}
								/>
								Seleccionar todos{search.trim() ? " los filtrados" : ""}
							</label>
							{users.map((user) => (
								<label
									key={user.id}
									htmlFor={`members-user-${user.id}`}
									className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
								>
									<Checkbox
										id={`members-user-${user.id}`}
										className="mt-0.5"
										checked={userIds.includes(user.id)}
										onCheckedChange={(checked) =>
											toggleUser(user.id, checked === true)
										}
									/>
									<span className="min-w-0 flex-1">
										<span className="block truncate">{user.name}</span>
										<span className="block truncate text-xs text-muted-foreground">
											{user.email}
										</span>
									</span>
								</label>
							))}
						</>
					)}
				</div>
				{directory.isError && (
					<FieldError>No se pudieron cargar los usuarios.</FieldError>
				)}
			</Field>

			<Field orientation="horizontal">
				<Checkbox
					id="members-head"
					checked={makeHead}
					onCheckedChange={(checked) => setMakeHead(checked === true)}
				/>
				<div>
					<FieldLabel htmlFor="members-head">
						Marcar como jefes del departamento
					</FieldLabel>
					<FieldDescription>
						Sin marcar, solo serán jefes quienes tengan el rol admin.
					</FieldDescription>
				</div>
			</Field>

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Cancelar
				</Button>
				<Button type="submit" disabled={!canSubmit}>
					<LoadingSwap isLoading={addMembers.isPending}>
						Agregar{userIds.length > 0 ? ` ${userIds.length}` : ""}
					</LoadingSwap>
				</Button>
			</DialogFooter>
		</form>
	);
}
