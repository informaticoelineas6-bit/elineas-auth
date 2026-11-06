import { hasPermission } from "@elineas/auth-contracts";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListPlus, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	DataTable,
	DataTableFilterSelect,
	useListControls,
} from "@/modules/common/components/data-table";
import { ExportMenu } from "@/modules/common/components/import-export/export-menu.tsx";
import { ImportDialog } from "@/modules/common/components/import-export/import-dialog.tsx";
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
import { deferOnClient } from "@/modules/common/lib/query.ts";
import type { ExportFormat } from "@/modules/common/lib/tabular.ts";
import { BulkCreateDepartmentsDialog } from "@/modules/departments/components/bulk-create-departments-dialog.tsx";
import { getDepartmentColumns } from "@/modules/departments/lib/columns.tsx";
import { exportDepartments } from "@/modules/departments/lib/import-export.ts";
import { mapDepartmentRows } from "@/modules/departments/lib/import-validate.ts";
import { departmentFiltersSchema } from "@/modules/departments/lib/validation.ts";
import {
	departmentsQueries,
	useCreateDepartment,
	useDeleteDepartment,
	useExportDepartments,
	useUpdateDepartment,
} from "@/modules/departments/queries/departments.ts";
import type {
	DepartmentFilters,
	DepartmentListItem,
} from "@/modules/departments/shared/types.ts";
import { requireResourceAccess } from "@/modules/permissions/lib/guard.ts";

export const Route = createFileRoute("/_authed/departments/")({
	validateSearch: departmentFiltersSchema,
	beforeLoad: ({ context }) => requireResourceAccess("departments", context),
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, deps }) =>
		deferOnClient(queryClient.prefetchQuery(departmentsQueries.list(deps))),
	component: DepartmentsPage,
});

function DepartmentsPage() {
	const navigate = useNavigate();
	const { isAdmin, permissions } = Route.useRouteContext();
	const access = { isAdmin, permissions };
	const canWrite = hasPermission("departments", "write", access);
	const canDelete = hasPermission("departments", "delete", access);

	const { filters, controls, setFilter } = useListControls<DepartmentFilters>();
	const query = useQuery(departmentsQueries.list(filters));
	const deleteDepartment = useDeleteDepartment();
	const createDepartment = useCreateDepartment();
	const updateDepartment = useUpdateDepartment();
	const exportDepartmentsQuery = useExportDepartments();
	const [importOpen, setImportOpen] = useState(false);

	const [target, setTarget] = useState<DepartmentListItem | null>(null);
	const [bulk, setBulk] = useState<{
		rows: DepartmentListItem[];
		clear: () => void;
	} | null>(null);
	const [bulkCreateOpen, setBulkCreateOpen] = useState(false);

	const isForbidden = getErrorStatus(query.error) === 403;

	const columns = getDepartmentColumns({
		canWrite,
		canDelete,
		onView: (department) =>
			navigate({
				to: "/departments/$departmentId",
				params: { departmentId: department.id },
			}),
		onEdit: (department) =>
			navigate({
				to: "/departments/$departmentId/edit",
				params: { departmentId: department.id },
			}),
		onDelete: (department) => setTarget(department),
	});

	// Exporta TODOS los departamentos que cumplan los filtros activos (no solo la
	// página visible) en el formato elegido.
	function handleExport(format: ExportFormat) {
		const { page: _page, limit: _limit, ...rest } = filters;
		exportDepartmentsQuery.mutate(rest, {
			onSuccess: async (departments) => {
				if (departments.length === 0) {
					toast.info("No hay departamentos que exportar con estos filtros");
					return;
				}
				try {
					await exportDepartments(departments, format);
					toast.success(`${departments.length} departamento(s) exportado(s)`);
				} catch (error) {
					reportError(error, "No se pudo generar el archivo.");
				}
			},
			onError: (error) => reportError(error, "No se pudo exportar el listado."),
		});
	}

	function confirmDelete() {
		if (!target) return;
		deleteDepartment.mutate(target.id, {
			onSuccess: () => {
				toast.success(`Departamento "${target.name}" eliminado`);
				setTarget(null);
			},
			onError: (error) => reportError(error),
		});
	}

	async function confirmBulkDelete() {
		if (!bulk) return;
		try {
			await Promise.all(
				bulk.rows.map((row) => deleteDepartment.mutateAsync(row.id)),
			);
			toast.success(`${bulk.rows.length} departamento(s) eliminado(s)`);
			bulk.clear();
			setBulk(null);
		} catch (error) {
			reportError(error);
		}
	}

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Departamentos" }]} />
			<PageHeader
				title="Departamentos"
				description="Agrupa a las personas por departamento y define a sus jefes."
				actions={
					<>
						<ExportMenu
							onExport={handleExport}
							pending={exportDepartmentsQuery.isPending}
						/>
						{canWrite && (
							<>
								<Button variant="outline" onClick={() => setImportOpen(true)}>
									<Upload />
									Importar
								</Button>
								<Button
									variant="outline"
									onClick={() => setBulkCreateOpen(true)}
								>
									<ListPlus />
									Crear varios
								</Button>
								<Button onClick={() => navigate({ to: "/departments/new" })}>
									<Plus />
									Nuevo departamento
								</Button>
							</>
						)}
					</>
				}
			/>

			{isForbidden ? (
				<ForbiddenState description={getErrorMessage(query.error)} />
			) : (
				<DataTable
					columns={columns}
					data={query.data?.departments ?? []}
					pagination={query.data?.pagination}
					isLoading={query.isPending}
					isFetching={query.isFetching}
					isError={query.isError}
					onRetry={() => query.refetch()}
					{...controls}
					getRowId={(department) => department.id}
					searchPlaceholder="Buscar por nombre…"
					emptyTitle="Sin departamentos"
					emptyDescription="Aún no hay departamentos registrados."
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
					enableRowSelection={canDelete}
					renderSelectionActions={(rows, clear) => (
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setBulk({ rows, clear })}
						>
							<Trash2 />
							Eliminar
						</Button>
					)}
				/>
			)}

			<ConfirmDialog
				open={target !== null}
				onOpenChange={(open) => !open && setTarget(null)}
				title="Eliminar departamento"
				description={
					target
						? `¿Seguro que quieres eliminar "${target.name}"? Sus miembros quedarán sin este departamento. Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteDepartment.isPending}
				onConfirm={confirmDelete}
			/>

			<ConfirmDialog
				open={bulk !== null}
				onOpenChange={(open) => !open && setBulk(null)}
				title="Eliminar departamentos"
				description={
					bulk
						? `¿Seguro que quieres eliminar ${bulk.rows.length} departamento(s)? Sus miembros quedarán sin ellos. Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteDepartment.isPending}
				onConfirm={confirmBulkDelete}
			/>

			<ImportDialog
				open={importOpen}
				onOpenChange={setImportOpen}
				title="Importar departamentos"
				description={
					<>
						Sube un archivo CSV, JSON o Excel con las columnas <code>name</code>
						, <code>description</code> y <code>active</code>. Si una fila trae{" "}
						<code>id</code>, actualiza ese departamento; si no, crea uno nuevo.
					</>
				}
				mapRows={async (raw) => mapDepartmentRows(raw)}
				onCreate={(input) => createDepartment.mutateAsync(input)}
				onUpdate={(id, input) => updateDepartment.mutateAsync({ id, input })}
			/>

			<BulkCreateDepartmentsDialog
				open={bulkCreateOpen}
				onOpenChange={setBulkCreateOpen}
			/>
		</div>
	);
}
