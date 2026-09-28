import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
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
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { Textarea } from "@/modules/common/components/ui/textarea.tsx";
import { reportError } from "@/modules/common/lib/errors.ts";
import {
	permissionToFormValues,
	toUpdatePermissionPayload,
	useEditPermissionForm,
} from "@/modules/permissions/lib/form.ts";
import {
	useAssignPermissionToRole,
	useRemovePermissionFromSystem,
	useUnassignPermissionFromRole,
	useUpdatePermission,
} from "@/modules/permissions/queries/permissions.ts";
import type { SystemPermission } from "@/modules/permissions/shared/types.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import type { System } from "@/modules/systems/shared/types.ts";

// Edita un permiso del catálogo (resource/action/description, GLOBAL: afecta
// a cualquier otro sistema que también lo tenga) y controla en qué roles de
// `system` queda asignado. "Quitar del sistema" es la limpieza completa
// (desasigna de todos los roles del sistema y borra el permiso del catálogo
// si queda huérfano); el toggle por rol es más fino.
export function EditPermissionDialog({
	system,
	permission,
	open,
	onOpenChange,
}: {
	system: System;
	permission: SystemPermission;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const rolesQuery = useQuery(
		rolesQueries.list({ systemId: system.id, limit: 100 }),
	);
	const roles = rolesQuery.data?.roles ?? [];
	const assignedRoleIds = new Set(permission.roles.map((r) => r.id));

	const updatePermission = useUpdatePermission();
	const assignToRole = useAssignPermissionToRole();
	const unassignFromRole = useUnassignPermissionFromRole();
	const removeFromSystem = useRemovePermissionFromSystem();
	const [confirmDelete, setConfirmDelete] = useState(false);

	const form = useEditPermissionForm(
		permissionToFormValues(permission),
		async (value) => {
			try {
				await updatePermission.mutateAsync({
					id: permission.id,
					input: toUpdatePermissionPayload(value),
				});
				toast.success("Permiso actualizado");
				onOpenChange(false);
			} catch (error) {
				reportError(error, "No se pudo actualizar el permiso.");
			}
		},
	);

	function toggleRole(roleId: string, checked: boolean) {
		const mutation = checked
			? assignToRole.mutateAsync({ id: permission.id, roleId })
			: unassignFromRole.mutateAsync({ id: permission.id, roleId });
		mutation.catch((error) =>
			reportError(error, "No se pudo actualizar el rol."),
		);
	}

	function confirmRemoveFromSystem() {
		removeFromSystem.mutate(
			{ id: permission.id, systemId: system.id },
			{
				onSuccess: () => {
					toast.success(
						`Permiso "${permission.resource}:${permission.action}" quitado de ${system.name}`,
					);
					setConfirmDelete(false);
					onOpenChange(false);
				},
				onError: (error) => reportError(error),
			},
		);
	}

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Editar {permission.resource}:{permission.action}
						</DialogTitle>
						<DialogDescription>
							El permiso es global: cambiar el recurso o la acción afecta a
							todos los sistemas que lo tengan asignado, no solo a {system.name}
							.
						</DialogDescription>
					</DialogHeader>

					<form
						id="edit-permission-form"
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<FieldGroup className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
							<form.Field name="resource">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name} required>
												Recurso
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value ?? ""}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="off"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							</form.Field>

							<form.Field name="action">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name} required>
												Acción
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value ?? ""}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="off"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							</form.Field>

							<form.Field name="description">
								{(field) => (
									<Field className="md:col-span-2">
										<FieldLabel htmlFor={field.name}>Descripción</FieldLabel>
										<Textarea
											id={field.name}
											name={field.name}
											value={field.state.value ?? ""}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											rows={2}
										/>
									</Field>
								)}
							</form.Field>
						</FieldGroup>
					</form>

					<FieldSeparator />

					<Field>
						<FieldLabel>Roles de {system.name} con este permiso</FieldLabel>
						<FieldDescription>
							Marca o desmarca los roles de este sistema que deben tener el
							permiso.
						</FieldDescription>
						{rolesQuery.isPending ? (
							<p className="text-sm text-muted-foreground">Cargando roles…</p>
						) : roles.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Este sistema aún no tiene roles.
							</p>
						) : (
							<div className="space-y-2 mt-1">
								{roles.map((role) => (
									<label
										key={role.id}
										className="flex items-center gap-2 text-sm"
										htmlFor={`role-${role.id}`}
									>
										<Checkbox
											id={`role-${role.id}`}
											checked={assignedRoleIds.has(role.id)}
											onCheckedChange={(checked) =>
												toggleRole(role.id, checked === true)
											}
										/>
										{role.name}
									</label>
								))}
							</div>
						)}
					</Field>

					<DialogFooter className="justify-between sm:justify-between">
						<Button
							type="button"
							variant="destructive"
							onClick={() => setConfirmDelete(true)}
						>
							Quitar de {system.name}
						</Button>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cerrar
							</Button>
							<form.Subscribe
								selector={(state) => ({
									canSubmit: state.canSubmit,
									isSubmitting: state.isSubmitting,
								})}
							>
								{({ canSubmit, isSubmitting }) => (
									<Button
										type="submit"
										form="edit-permission-form"
										disabled={!canSubmit}
									>
										<LoadingSwap isLoading={isSubmitting}>Guardar</LoadingSwap>
									</Button>
								)}
							</form.Subscribe>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Quitar permiso de ${system.name}`}
				description={`Se desasignará "${permission.resource}:${permission.action}" de todos los roles de ${system.name}. Si ningún otro sistema lo usa, también se eliminará del catálogo. Esta acción no se puede deshacer.`}
				confirmLabel="Quitar"
				destructive
				loading={removeFromSystem.isPending}
				onConfirm={confirmRemoveFromSystem}
			/>
		</>
	);
}
