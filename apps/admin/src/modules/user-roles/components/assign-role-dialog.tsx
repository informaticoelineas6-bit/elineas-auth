import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Combobox } from "@/modules/common/components/partials/combobox.tsx";
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
import { toCreateUserRolePayload, useAssignUserRoleForm } from "../lib/form.ts";
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
						Concede a un usuario un rol de un sistema. Sin al menos un rol, el
						usuario no puede iniciar sesión en ningún sistema.
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
			try {
				await createUserRole.mutateAsync(toCreateUserRolePayload(value));
				toast.success("Rol asignado");
				onDone();
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 409) {
					setConflict(
						getErrorMessage(error, "Este usuario ya tiene ese rol asignado."),
					);
				} else if (status === 429) {
					toast.error(
						"Demasiados intentos. Espera unos segundos antes de reintentar.",
					);
				} else {
					reportError(error, "No se pudo asignar el rol. Intenta nuevamente.");
				}
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
									form.setFieldValue("roleId", "");
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

			<form.Field name="roleId">
				{(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel htmlFor={field.name} required>
								Rol
							</FieldLabel>
							<Combobox
								id={field.name}
								value={field.state.value || undefined}
								onChange={(value) => {
									field.handleChange(value ?? "");
									setConflict(undefined);
								}}
								options={roleOptions}
								disabled={!systemId}
								placeholder={
									!systemId
										? "Elige primero un sistema"
										: rolesQuery.isPending
											? "Cargando roles…"
											: "Selecciona un rol"
								}
								searchPlaceholder="Buscar rol…"
								emptyText="Este sistema no tiene roles"
								ariaInvalid={isInvalid}
							/>
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
							<LoadingSwap isLoading={isSubmitting}>Asignar rol</LoadingSwap>
						</Button>
					)}
				</form.Subscribe>
			</DialogFooter>
		</form>
	);
}
