import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	DataTable,
	DataTableFilterSelect,
	DataTableRowActions,
	useListControls,
} from "@/modules/common/components/data-table";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { reportError } from "@/modules/common/lib/errors.ts";
import { systemFiltersSchema } from "@/modules/systems/lib/validation.ts";
import {
	systemsQueries,
	useDeleteSystem,
} from "@/modules/systems/queries/systems.ts";
import type { System, SystemFilters } from "@/modules/systems/shared/types.ts";

export const Route = createFileRoute("/_authed/systems")({
	validateSearch: systemFiltersSchema,
	component: SystemsPage,
});

function SystemsPage() {
	const { filters, controls, setFilter } = useListControls<SystemFilters>();
	const query = useQuery(systemsQueries.list(filters));
	const deleteSystem = useDeleteSystem();

	const [target, setTarget] = useState<System | null>(null);
	const [bulk, setBulk] = useState<{
		rows: System[];
		clear: () => void;
	} | null>(null);

	const total = query.data?.pagination.total ?? 0;
	const canDelete = total > 1;

	const columns: ColumnDef<System, unknown>[] = [
		{ accessorKey: "name", header: "Nombre" },
		{
			accessorKey: "slug",
			header: "Slug",
			cell: ({ row }) => (
				<span className="text-muted-foreground">{row.original.slug}</span>
			),
		},
		{
			accessorKey: "active",
			header: "Estado",
			cell: ({ row }) => (
				<Badge variant={row.original.active ? "default" : "secondary"}>
					{row.original.active ? "Activo" : "Inactivo"}
				</Badge>
			),
		},
		{
			id: "actions",
			header: "Acciones",
			meta: { className: "text-right", headerClassName: "text-right" },
			cell: ({ row }) => (
				<DataTableRowActions
					actions={[
						{
							label: "Editar",
							icon: Pencil,
							onSelect: () => toast.info("Edición disponible en #7"),
						},
						{
							label: "Eliminar",
							icon: Trash2,
							destructive: true,
							disabled: !canDelete,
							onSelect: () => setTarget(row.original),
						},
					]}
				/>
			),
		},
	];

	function confirmDelete() {
		if (!target) return;
		deleteSystem.mutate(target.id, {
			onSuccess: () => {
				toast.success(`Sistema "${target.name}" eliminado`);
				setTarget(null);
			},
			onError: (error) => reportError(error),
		});
	}

	async function confirmBulkDelete() {
		if (!bulk) return;
		try {
			await Promise.all(
				bulk.rows.map((row) => deleteSystem.mutateAsync(row.id)),
			);
			toast.success(`${bulk.rows.length} sistema(s) eliminado(s)`);
			bulk.clear();
			setBulk(null);
		} catch (error) {
			reportError(error);
		}
	}

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Sistemas" }]} />
			<PageHeader
				title="Sistemas"
				description="Administra los sistemas integrados con el Identity Server."
			/>

			<DataTable
				columns={columns}
				data={query.data?.systems ?? []}
				pagination={query.data?.pagination}
				isLoading={query.isPending}
				isFetching={query.isFetching}
				isError={query.isError}
				onRetry={() => query.refetch()}
				{...controls}
				getRowId={(system) => system.id}
				searchPlaceholder="Buscar por nombre o slug…"
				emptyTitle="Sin sistemas"
				emptyDescription="Aún no hay sistemas registrados."
				filters={
					<DataTableFilterSelect
						value={filters.active}
						onChange={(value) => setFilter("active", value)}
						placeholder="Estado"
						options={[
							{ label: "Activo", value: true },
							{ label: "Inactivo", value: false },
						]}
					/>
				}
				enableRowSelection
				renderSelectionActions={(rows, clear) => (
					<Button
						variant="destructive"
						size="sm"
						// Debe quedar al menos un sistema: no se permite borrar la
						// selección si abarca todas las filas existentes.
						disabled={!canDelete || rows.length >= total}
						onClick={() => setBulk({ rows, clear })}
					>
						<Trash2 />
						Eliminar
					</Button>
				)}
			/>

			<ConfirmDialog
				open={target !== null}
				onOpenChange={(open) => !open && setTarget(null)}
				title="Eliminar sistema"
				description={
					target
						? `¿Seguro que quieres eliminar "${target.name}"? Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteSystem.isPending}
				onConfirm={confirmDelete}
			/>

			<ConfirmDialog
				open={bulk !== null}
				onOpenChange={(open) => !open && setBulk(null)}
				title="Eliminar sistemas"
				description={
					bulk
						? `¿Seguro que quieres eliminar ${bulk.rows.length} sistema(s)? Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteSystem.isPending}
				onConfirm={confirmBulkDelete}
			/>
		</div>
	);
}
