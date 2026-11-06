import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Combobox } from "@/modules/common/components/partials/combobox.tsx";
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
	FieldError,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { runBulk } from "@/modules/common/lib/bulk.ts";
import { getErrorStatus, reportError } from "@/modules/common/lib/errors.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import { useUserDirectory } from "../lib/use-user-directory.ts";
import { useCreateUserRole } from "../queries/user-roles.ts";

// Diálogo "Asignar a varios usuarios": un rol de un sistema → N usuarios.
export function BulkAssignRoleDialog({
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
					<DialogTitle>Asignar rol a varios usuarios</DialogTitle>
					<DialogDescription>
						Elige un sistema, un rol y los usuarios que lo recibirán. Quienes ya
						lo tengan se omiten.
					</DialogDescription>
				</DialogHeader>
				{/* Se monta solo abierto para reiniciar el estado en cada apertura. */}
				{open && <BulkAssignForm onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function BulkAssignForm({ onDone }: { onDone: () => void }) {
	const createUserRole = useCreateUserRole();
	const [systemId, setSystemId] = useState("");
	const [roleId, setRoleId] = useState("");
	const [userIds, setUserIds] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);

	// Directorio con búsqueda en el servidor (los admins de sistema no pueden
	// listar empleados). La búsqueda ya llega filtrada: no se filtra en cliente.
	const directory = useUserDirectory({ limit: 100 });
	const { search, setSearch } = directory;
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const rolesQuery = useQuery({
		...rolesQueries.list({ systemId, limit: 100 }),
		enabled: Boolean(systemId),
	});

	const filteredUsers = useMemo(
		() =>
			directory.users.map((user) => ({
				id: user.id,
				name: user.employeeName ?? user.name,
				email: user.email,
			})),
		[directory.users],
	);

	const systemOptions = (systemsQuery.data?.systems ?? [])
		.filter((system) => system.active)
		.map((system) => ({ value: system.id, label: system.name }));
	const roleOptions = (rolesQuery.data?.roles ?? []).map((role) => ({
		value: role.id,
		label: role.name,
		description: role.description ?? undefined,
	}));

	const allVisibleSelected =
		filteredUsers.length > 0 &&
		filteredUsers.every((user) => userIds.includes(user.id));

	function toggleUser(id: string, checked: boolean) {
		setUserIds((prev) =>
			checked ? [...prev, id] : prev.filter((userId) => userId !== id),
		);
	}

	function toggleAllVisible(checked: boolean) {
		const visible = new Set(filteredUsers.map((user) => user.id));
		setUserIds((prev) => {
			const rest = prev.filter((id) => !visible.has(id));
			return checked ? [...rest, ...visible] : rest;
		});
	}

	const canSubmit = Boolean(roleId) && userIds.length > 0 && !submitting;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		setSubmitting(true);
		try {
			const { ok, failed } = await runBulk(userIds, (userId) =>
				createUserRole.mutateAsync({ userId, roleId }),
			);
			// 409: el usuario ya tenía el rol; no es un error real.
			const already = failed.filter((f) => getErrorStatus(f.error) === 409);
			const errors = failed.filter((f) => getErrorStatus(f.error) !== 409);

			if (ok > 0) {
				toast.success(
					ok === 1
						? "Rol asignado a 1 usuario"
						: `Rol asignado a ${ok} usuarios`,
				);
			}
			if (already.length > 0) {
				const names = already.map((f) => {
					const user = directory.lookup(f.row);
					return user
						? `${user.employeeName ?? user.name} (${user.email})`
						: f.row;
				});
				toast.info(
					`${already.length} usuario(s) ya tenían el rol y se omitieron`,
					{ description: names.join(", ") },
				);
			}
			if (errors.length === 0) {
				onDone();
				return;
			}
			// Quedan seleccionados solo los que fallaron para poder reintentar.
			setUserIds(errors.map((f) => f.row));
			if (getErrorStatus(errors[0].error) === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(
					errors[0].error,
					`No se pudo asignar el rol a ${errors.length} usuario(s).`,
				);
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<Field>
				<FieldLabel htmlFor="bulk-system" required>
					Sistema
				</FieldLabel>
				<Combobox
					id="bulk-system"
					value={systemId || undefined}
					onChange={(value) => {
						setSystemId(value ?? "");
						setRoleId("");
					}}
					options={systemOptions}
					placeholder={
						systemsQuery.isPending
							? "Cargando sistemas…"
							: "Selecciona un sistema"
					}
					searchPlaceholder="Buscar sistema…"
					emptyText="Sin sistemas activos"
				/>
			</Field>

			<Field>
				<FieldLabel htmlFor="bulk-role" required>
					Rol
				</FieldLabel>
				<Combobox
					id="bulk-role"
					value={roleId || undefined}
					onChange={(value) => setRoleId(value ?? "")}
					options={roleOptions}
					placeholder={
						!systemId
							? "Elige primero un sistema"
							: rolesQuery.isPending
								? "Cargando roles…"
								: "Selecciona un rol"
					}
					searchPlaceholder="Buscar rol…"
					emptyText="Este sistema no tiene roles"
					disabled={!systemId}
				/>
			</Field>

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
					) : filteredUsers.length === 0 ? (
						<p className="px-2 py-4 text-center text-sm text-muted-foreground">
							Sin usuarios con cuenta
						</p>
					) : (
						<>
							<label
								htmlFor="bulk-all"
								className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover:bg-accent"
							>
								<Checkbox
									id="bulk-all"
									checked={allVisibleSelected}
									onCheckedChange={(checked) =>
										toggleAllVisible(checked === true)
									}
								/>
								Seleccionar todos{search.trim() ? " los filtrados" : ""}
							</label>
							{filteredUsers.map((user) => (
								<label
									key={user.id}
									htmlFor={`bulk-user-${user.id}`}
									className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
								>
									<Checkbox
										id={`bulk-user-${user.id}`}
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

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Cancelar
				</Button>
				<Button type="submit" disabled={!canSubmit}>
					<LoadingSwap isLoading={submitting}>
						Asignar{userIds.length > 0 ? ` a ${userIds.length}` : ""}
					</LoadingSwap>
				</Button>
			</DialogFooter>
		</form>
	);
}
