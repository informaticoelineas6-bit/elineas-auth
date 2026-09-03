import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/modules/common/components/ui/select.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { RoleFields } from "@/modules/roles/components/role-fields.tsx";
import {
	toCreateRolePayload,
	useCreateRoleForm,
} from "@/modules/roles/lib/form.ts";
import { useCreateRole } from "@/modules/roles/queries/roles.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";

export const Route = createFileRoute("/_authed/roles/new")({
	component: NewRolePage,
});

function NewRolePage() {
	const navigate = useNavigate();
	const createRole = useCreateRole();
	// Mismo filtro que el listado ({ limit: 100 }) para reutilizar la query cache
	// de sistemas; los inactivos se descartan en el select (no se les asignan
	// roles nuevos).
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const activeSystems = (systemsQuery.data?.systems ?? []).filter(
		(system) => system.active,
	);
	// 409 del IS: nombre de rol duplicado dentro del mismo sistema.
	const [nameError, setNameError] = useState<string | undefined>();

	const form = useCreateRoleForm("", async (value) => {
		setNameError(undefined);
		try {
			const role = await createRole.mutateAsync(toCreateRolePayload(value));
			toast.success(`Rol "${role.name}" creado`);
			navigate({ to: "/roles", search: { systemId: value.systemId } });
		} catch (error) {
			const status = getErrorStatus(error);
			if (status === 409) {
				setNameError(
					getErrorMessage(
						error,
						"Ya existe un rol con ese nombre en el sistema",
					),
				);
			} else if (status === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(error, "No se pudo crear el rol. Intenta nuevamente.");
			}
		}
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[{ label: "Roles", to: "/roles" }, { label: "Nuevo" }]}
			/>
			<PageHeader
				title="Nuevo rol"
				description="Los roles pertenecen a un sistema y agrupan los permisos de sus usuarios."
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="w-full"
			>
				<RoleFields
					form={form}
					nameError={nameError}
					systemField={
						<form.Field name="systemId">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name} required>
											Sistema
										</FieldLabel>
										<Select
											value={field.state.value || undefined}
											onValueChange={(value) => field.handleChange(value)}
										>
											<SelectTrigger
												id={field.name}
												aria-invalid={isInvalid}
												className="w-full"
												disabled={systemsQuery.isPending}
											>
												<SelectValue
													placeholder={
														systemsQuery.isPending
															? "Cargando sistemas…"
															: "Selecciona un sistema"
													}
												/>
											</SelectTrigger>
											<SelectContent>
												{activeSystems.map((system) => (
													<SelectItem key={system.id} value={system.id}>
														{system.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{!systemsQuery.isPending && activeSystems.length === 0 && (
											<FieldDescription>
												No hay sistemas activos. Crea o activa un sistema antes
												de definir roles.
											</FieldDescription>
										)}
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
					}
				/>

				<div className="mt-8 flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: "/roles" })}
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
							<Button type="submit" disabled={!canSubmit}>
								<LoadingSwap isLoading={isSubmitting}>Crear rol</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
