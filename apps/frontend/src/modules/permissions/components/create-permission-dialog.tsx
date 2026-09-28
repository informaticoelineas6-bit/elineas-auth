import { useQuery } from "@tanstack/react-query";
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
	FieldGroup,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/modules/common/components/ui/select.tsx";
import { Textarea } from "@/modules/common/components/ui/textarea.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import {
	assignPermissionFormDefaults,
	toAssignPermissionPayload,
	useAssignPermissionForm,
} from "@/modules/permissions/lib/form.ts";
import { useAssignPermission } from "@/modules/permissions/queries/permissions.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import type { System } from "@/modules/systems/shared/types.ts";

// Crea (o reutiliza) un permiso `resource:action` del catálogo y lo asigna a
// un rol de `system`. Es la vía del panel para dar de alta un permiso sin
// tocar la API a mano: el rol se elige entre los del sistema de la card
// desde la que se abrió el diálogo.
export function CreatePermissionDialog({
	system,
	open,
	onOpenChange,
}: {
	system: System;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const rolesQuery = useQuery(
		rolesQueries.list({ systemId: system.id, limit: 100 }),
	);
	const roles = rolesQuery.data?.roles ?? [];
	const assignPermission = useAssignPermission();
	const [conflictError, setConflictError] = useState<string | undefined>();

	const form = useAssignPermissionForm(
		assignPermissionFormDefaults(system.id),
		async (value) => {
			setConflictError(undefined);
			try {
				await assignPermission.mutateAsync(toAssignPermissionPayload(value));
				toast.success(`Permiso "${value.resource}:${value.action}" asignado`);
				form.reset(assignPermissionFormDefaults(system.id));
				onOpenChange(false);
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 400) {
					setConflictError(
						getErrorMessage(error, "El rol elegido no pertenece al sistema"),
					);
				} else {
					reportError(
						error,
						"No se pudo crear el permiso. Intenta nuevamente.",
					);
				}
			}
		},
	);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) form.reset(assignPermissionFormDefaults(system.id));
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Nuevo permiso para {system.name}</DialogTitle>
					<DialogDescription>
						Se crea (o reutiliza si ya existe en el catálogo) el permiso
						resource:action y se asigna al rol elegido.
					</DialogDescription>
				</DialogHeader>

				<form
					id="create-permission-form"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
						<form.Field name="roleId">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid} className="md:col-span-2">
										<FieldLabel htmlFor={field.name} required>
											Rol
										</FieldLabel>
										<Select
											value={field.state.value || undefined}
											onValueChange={(value) => field.handleChange(value)}
										>
											<SelectTrigger
												id={field.name}
												aria-invalid={isInvalid}
												className="w-full"
												disabled={rolesQuery.isPending}
											>
												<SelectValue
													placeholder={
														rolesQuery.isPending
															? "Cargando roles…"
															: "Selecciona un rol"
													}
												/>
											</SelectTrigger>
											<SelectContent>
												{roles.map((role) => (
													<SelectItem key={role.id} value={role.id}>
														{role.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{!rolesQuery.isPending && roles.length === 0 && (
											<FieldDescription>
												Este sistema aún no tiene roles. Crea uno antes de
												asignarle permisos.
											</FieldDescription>
										)}
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
										{conflictError && <FieldError>{conflictError}</FieldError>}
									</Field>
								);
							}}
						</form.Field>

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
											placeholder="employees"
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
											placeholder="read"
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
										placeholder="Qué permite hacer este permiso…"
										rows={2}
									/>
								</Field>
							)}
						</form.Field>
					</FieldGroup>
				</form>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancelar
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
								form="create-permission-form"
								disabled={!canSubmit || roles.length === 0}
							>
								<LoadingSwap isLoading={isSubmitting}>
									Crear permiso
								</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
