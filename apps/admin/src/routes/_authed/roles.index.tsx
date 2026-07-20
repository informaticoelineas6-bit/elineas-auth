import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	DataTable,
	DataTableFilterSelect,
	useListControls,
} from "@/modules/common/components/data-table";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { getRoleColumns } from "@/modules/roles/lib/columns.tsx";
import { roleFiltersSchema } from "@/modules/roles/lib/validation.ts";
import { rolesQueries, useDeleteRole } from "@/modules/roles/queries/roles.ts";
import type { Role, RoleFilters } from "@/modules/roles/shared/types.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import type { System } from "@/modules/systems/shared/types.ts";

export const Route = createFileRoute("/_authed/roles/")({
	validateSearch: roleFiltersSchema,
	// Prefetch del listado + catálogo de sistemas (misma query key que el
	// componente) para calentar hover/SSR y evitar el waterfall montaje→fetch.
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, deps }) =>
		Promise.all([
			queryClient.prefetchQuery(rolesQueries.list(deps)),
			queryClient.prefetchQuery(systemsQueries.list({ limit: 100 })),
		]),
	component: RolesPage,
});

function RolesPage() {
	const navigate = useNavigate();
	const { filters, controls, setFilter } = useListControls<RoleFilters>();
	const query = useQuery(rolesQueries.list(filters));
	// Sistemas para resolver el nombre en la tabla y alimentar el filtro. Se
	// comparte por query cache (misma key en toda la app) y solo se pide una vez.
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const deleteRole = useDeleteRole();

	const [target, setTarget] = useState<Role | null>(null);

	const isForbidden = getErrorStatus(query.error) === 403;

	const systemsById = useMemo(
		() =>
			new Map<string, System>(
				(systemsQuery.data?.systems ?? []).map((system) => [system.id, system]),
			),
		[systemsQuery.data],
	);

	function confirmDelete() {
		if (!target) return;
		deleteRole.mutate(target.id, {
			onSuccess: () => {
				toast.success(`Rol "${target.name}" eliminado`);
				setTarget(null);
			},
			onError: (error) => {
				// Un 409 significa que el IS rechazó el borrado por asignaciones que
				// aún dependen del rol: se explica con el mensaje del IS.
				if (getErrorStatus(error) === 409) {
					toast.error("No se pudo eliminar el rol", {
						description: getErrorMessage(error),
					});
					setTarget(null);
				} else {
					reportError(error);
				}
			},
		});
	}

	const columns = getRoleColumns({
		systemsById,
		onEdit: (role) =>
			navigate({ to: "/roles/$roleId/edit", params: { roleId: role.id } }),
		onDelete: (role) => setTarget(role),
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Roles" }]} />
			<PageHeader
				title="Roles"
				description="Define los roles disponibles por sistema."
				actions={
					<Button onClick={() => navigate({ to: "/roles/new" })}>
						<Plus />
						Nuevo rol
					</Button>
				}
			/>

			{isForbidden ? (
				<ForbiddenState description="No tienes permisos para ver el listado de roles." />
			) : (
				<DataTable
					columns={columns}
					data={query.data?.roles ?? []}
					pagination={query.data?.pagination}
					isLoading={query.isPending}
					isFetching={query.isFetching}
					isError={query.isError}
					onRetry={() => query.refetch()}
					{...controls}
					getRowId={(role) => role.id}
					searchPlaceholder="Buscar por nombre…"
					emptyTitle="Sin roles"
					emptyDescription="Aún no hay roles definidos."
					filters={
						<DataTableFilterSelect
							value={filters.systemId}
							onChange={(value) => setFilter("systemId", value)}
							placeholder="Sistema"
							allLabel="Todos los sistemas"
							options={(systemsQuery.data?.systems ?? []).map((system) => ({
								label: system.name,
								value: system.id,
							}))}
						/>
					}
				/>
			)}

			<ConfirmDialog
				open={target !== null}
				onOpenChange={(open) => !open && setTarget(null)}
				title="Eliminar rol"
				description={
					target
						? `¿Seguro que quieres eliminar el rol "${target.name}"? Los usuarios que lo tengan asignado perderán el acceso que dependa de él. Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteRole.isPending}
				onConfirm={confirmDelete}
			/>
		</div>
	);
}
