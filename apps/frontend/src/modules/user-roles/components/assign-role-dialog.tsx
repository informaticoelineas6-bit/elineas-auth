import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { employeesQueries } from "@/modules/employees/queries/employees.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import {
	toCreateUserRolePayloads,
	useAssignUserRoleForm,
} from "../lib/form.ts";
import { useCreateUserRole } from "../queries/user-roles.ts";

export type LockedUser = { userId: string; label: string };

// Diálogo "Asignar rol": usuario + sistema + rol (el rol se acota al sistema
// elegido). Reutilizable desde la tabla de asignaciones y desde la ficha de un
// empleado (con el usuario ya fijado vía `lockedUser`).
export function AssignRoleDialog({
	open,
	onOpenChange,
	lockedUser,
	defaultSystemId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	lockedUser?: LockedUser;
	defaultSystemId?: string;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Asignar rol</DialogTitle>
					<DialogDescription>
						Concede a un usuario uno o más roles de un sistema. Puedes seguir
						asignando roles de otros sistemas sin cerrar la ventana.
					</DialogDescription>
				</DialogHeader>
				{/* Se monta solo con el diálogo abierto para reiniciar el formulario
				    en cada apertura. */}
				{open && (
					<AssignRoleForm
						lockedUser={lockedUser}
						defaultSystemId={defaultSystemId}
						onDone={() => onOpenChange(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function AssignRoleForm({
	lockedUser,
	defaultSystemId,
	onDone,
}: {
	lockedUser?: LockedUser;
	defaultSystemId?: string;
	onDone: () => void;
}) {
	const createUserRole = useCreateUserRole();
	// 409: el usuario ya tiene ese rol. Se muestra a pie de formulario.
	const [conflict, setConflict] = useState<string | undefined>();

	const form = useAssignUserRoleForm(
		{ userId: lockedUser?.userId, systemId: defaultSystemId },
		async (value) => {
			setConflict(undefined);
			// Una asignación por rol; se intentan todas y se informa el resultado.
			const failed: { roleId: string; error: unknown }[] = [];
			let created = 0;
			for (const payload of toCreateUserRolePayloads(value)) {
				try {
					await createUserRole.mutateAsync(payload);
					created += 1;
				} catch (error) {
					failed.push({ roleId: payload.roleId, error });
				}
			}

			if (created > 0) {
				toast.success(
					created === 1 ? "Rol asignado" : `${created} roles asignados`,
				);
			}

			if (failed.length === 0) {
				// La ventana sigue abierta: se limpian sistema y roles (el usuario se
				// conserva) para poder asignar más.
				form.setFieldValue("systemId", "");
				form.setFieldValue("roleIds", []);
				form.setFieldMeta("systemId", (meta) => ({
					...meta,
					isTouched: false,
				}));
				form.setFieldMeta("roleIds", (meta) => ({ ...meta, isTouched: false }));
				return;
			}

			// Se dejan seleccionados solo los roles que fallaron.
			form.setFieldValue(
				"roleIds",
				failed.map((f) => f.roleId),
			);
			const first = failed[0].error;
			const status = getErrorStatus(first);
			if (status === 409) {
				setConflict(
					failed.length === 1
						? getErrorMessage(first, "Este usuario ya tiene ese rol asignado.")
						: "El usuario ya tiene algunos de los roles seleccionados.",
				);
			} else if (status === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(
					first,
					"No se pudieron asignar los roles. Intenta nuevamente.",
				);
			}
		},
	);

	// El sistema seleccionado acota el select de rol (se observa del store para
	// poder disparar la query de roles fuera de <form.Field>).
	const systemId = useStore(form.store, (state) => state.values.systemId);

	// Empleados como fuente de usuarios (única forma de resolver nombre/email; no
	// hay endpoint admin de usuarios). Solo los que tienen cuenta enlazada.
	const employeesQuery = useQuery({
		...employeesQueries.list({ limit: 100 }),
		enabled: !lockedUser,
	});
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const rolesQuery = useQuery({
		...rolesQueries.list({ systemId, limit: 100 }),
		enabled: Boolean(systemId),
	});

	const userOptions = (employeesQuery.data?.employees ?? [])
		.filter((employee) => employee.userId && employee.user)
		.map((employee) => ({
			value: employee.userId as string,
			label: `${employee.name} ${employee.lastName}`,
			description: employee.user?.email,
		}));
	const systemOptions = (systemsQuery.data?.systems ?? [])
		.filter((system) => system.active)
		.map((system) => ({ value: system.id, label: system.name }));
	const roleOptions = (rolesQuery.data?.roles ?? []).map((role) => ({
		value: role.id,
		label: role.name,
		description: role.description ?? undefined,
	}));

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-5"
		>
			{lockedUser ? (
				<Field>
					<FieldLabel>Usuario</FieldLabel>
					<div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
						{lockedUser.label}
					</div>
				</Field>
			) : (
				<form.Field name="userId">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name} required>
									Usuario
								</FieldLabel>
								<Combobox
									id={field.name}
									value={field.state.value || undefined}
									onChange={(value) => field.handleChange(value ?? "")}
									options={userOptions}
									placeholder={
										employeesQuery.isPending
											? "Cargando usuarios…"
											: "Selecciona un usuario"
									}
									searchPlaceholder="Buscar por nombre o email…"
									emptyText="Sin usuarios con cuenta"
									ariaInvalid={isInvalid}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			)}

			<form.Field name="systemId">
				{(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel htmlFor={field.name} required>
								Sistema
							</FieldLabel>
							<Combobox
								id={field.name}
								value={field.state.value || undefined}
								onChange={(value) => {
									field.handleChange(value ?? "");
									// Cambiar de sistema invalida el rol elegido.
									form.setFieldValue("roleIds", []);
									setConflict(undefined);
								}}
								options={systemOptions}
								placeholder={
									systemsQuery.isPending
										? "Cargando sistemas…"
										: "Selecciona un sistema"
								}
								searchPlaceholder="Buscar sistema…"
								emptyText="Sin sistemas activos"
								ariaInvalid={isInvalid}
							/>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					);
				}}
			</form.Field>

			<form.Field name="roleIds">
				{(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid;
					const selected = field.state.value;
					function toggle(roleId: string, checked: boolean) {
						field.handleChange(
							checked
								? [...selected, roleId]
								: selected.filter((id) => id !== roleId),
						);
						setConflict(undefined);
					}
					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel required>Roles</FieldLabel>
							<div
								className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1"
								aria-invalid={isInvalid}
							>
								{!systemId ? (
									<p className="px-2 py-4 text-center text-sm text-muted-foreground">
										Elige primero un sistema
									</p>
								) : rolesQuery.isPending ? (
									<p className="px-2 py-4 text-center text-sm text-muted-foreground">
										Cargando roles…
									</p>
								) : roleOptions.length === 0 ? (
									<p className="px-2 py-4 text-center text-sm text-muted-foreground">
										Este sistema no tiene roles
									</p>
								) : (
									roleOptions.map((role) => (
										<label
											key={role.value}
											htmlFor={`role-${role.value}`}
											className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
										>
											<Checkbox
												id={`role-${role.value}`}
												className="mt-0.5"
												checked={selected.includes(role.value)}
												onCheckedChange={(checked) =>
													toggle(role.value, checked === true)
												}
											/>
											<span className="min-w-0 flex-1">
												<span className="block truncate">{role.label}</span>
												{role.description && (
													<span className="block truncate text-xs text-muted-foreground">
														{role.description}
													</span>
												)}
											</span>
										</label>
									))
								)}
							</div>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					);
				}}
			</form.Field>

			{conflict && <FieldError className="text-sm">{conflict}</FieldError>}

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Cancelar
				</Button>
				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button type="submit" disabled={!canSubmit}>
							<LoadingSwap isLoading={isSubmitting}>Asignar</LoadingSwap>
						</Button>
					)}
				</form.Subscribe>
			</DialogFooter>
		</form>
	);
}
