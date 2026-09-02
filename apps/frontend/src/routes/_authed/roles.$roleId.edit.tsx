import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { NotFoundState } from "@/modules/common/components/partials/not-found-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { RoleFields } from "@/modules/roles/components/role-fields.tsx";
import {
	roleToFormValues,
	toUpdateRolePayload,
	useEditRoleForm,
} from "@/modules/roles/lib/form.ts";
import { rolesQueries, useUpdateRole } from "@/modules/roles/queries/roles.ts";
import type { Role } from "@/modules/roles/shared/types.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";

export const Route = createFileRoute("/_authed/roles/$roleId/edit")({
	// Prefetch del detalle + catálogo de sistemas (mismas query keys) para
	// calentar hover/SSR.
	loader: ({ context: { queryClient }, params }) =>
		Promise.all([
			queryClient.prefetchQuery(rolesQueries.detail(params.roleId)),
			queryClient.prefetchQuery(systemsQueries.list({ limit: 100 })),
		]),
	component: EditRolePage,
});

function EditRolePage() {
	const { roleId } = Route.useParams();
	const query = useQuery(rolesQueries.detail(roleId));

	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Roles", to: "/roles" },
					{ label: query.data ? query.data.name : "Detalle" },
					{ label: "Editar" },
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Rol no encontrado"
					description="El rol que quieres editar no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/roles">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description="No tienes permisos para editar este rol." />
			) : query.isError ? (
				<NotFoundState
					title="No se pudo cargar el rol"
					description={getErrorMessage(query.error)}
					action={
						<Button variant="outline" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					}
				/>
			) : query.isPending ? (
				<div className="space-y-6">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-64 rounded-xl" />
				</div>
			) : (
				<EditRoleForm role={query.data} />
			)}
		</div>
	);
}

function EditRoleForm({ role }: { role: Role }) {
	const navigate = useNavigate();
	const updateRole = useUpdateRole();
	// Nombre del sistema al que pertenece el rol (contexto de solo lectura: el IS
	// no permite cambiar el systemId de un rol existente).
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const systemName = systemsQuery.data?.systems.find(
		(system) => system.id === role.systemId,
	)?.name;
	const [nameError, setNameError] = useState<string | undefined>();

	const form = useEditRoleForm(roleToFormValues(role), async (value) => {
		setNameError(undefined);
		try {
			await updateRole.mutateAsync({
				id: role.id,
				input: toUpdateRolePayload(value),
			});
			toast.success("Cambios guardados");
			navigate({ to: "/roles", search: { systemId: role.systemId } });
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
				reportError(
					error,
					"No se pudieron guardar los cambios. Intenta nuevamente.",
				);
			}
		}
	});

	return (
		<>
			<PageHeader
				title="Editar rol"
				description={
					systemName
						? `Rol del sistema "${systemName}". El sistema no se puede cambiar.`
						: "El sistema al que pertenece el rol no se puede cambiar."
				}
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="w-full"
			>
				<RoleFields form={form} nameError={nameError} />

				<div className="mt-8 flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							navigate({ to: "/roles", search: { systemId: role.systemId } })
						}
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
								<LoadingSwap isLoading={isSubmitting}>
									Guardar cambios
								</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</>
	);
}
