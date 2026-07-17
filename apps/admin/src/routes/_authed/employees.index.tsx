import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";
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
import { getErrorStatus, reportError } from "@/modules/common/lib/errors.ts";
import { getEmployeeColumns } from "@/modules/employees/lib/columns.tsx";
import { employeeFiltersSchema } from "@/modules/employees/lib/validation.ts";
import {
	employeesQueries,
	useDeleteEmployee,
	useUpdateEmployee,
} from "@/modules/employees/queries/employees.ts";
import type {
	Employee,
	EmployeeFilters,
} from "@/modules/employees/shared/types.ts";

export const Route = createFileRoute("/_authed/employees")({
	// Búsqueda/filtro/página viajan en la URL con el mismo schema que el server fn.
	validateSearch: employeeFiltersSchema,
	component: EmployeesPage,
});

function EmployeesPage() {
	const { filters, controls, setFilter } = useListControls<EmployeeFilters>();
	const query = useQuery(employeesQueries.list(filters));
	const updateEmployee = useUpdateEmployee();
	const deleteEmployee = useDeleteEmployee();

	// Confirmaciones para las acciones destructivas/sensibles.
	const [toDelete, setToDelete] = useState<Employee | null>(null);
	const [toDeactivate, setToDeactivate] = useState<Employee | null>(null);

	// Un 403 del IS es "sin permisos", no un error genérico con reintentar.
	const isForbidden = getErrorStatus(query.error) === 403;

	// Activar es inmediato; desactivar pide confirmación (deja al empleado de baja).
	function toggleActive(employee: Employee) {
		if (employee.active) {
			setToDeactivate(employee);
			return;
		}
		updateEmployee.mutate(
			{ id: employee.id, input: { active: true } },
			{
				onSuccess: () => toast.success(`${employee.name} activado`),
				onError: (error) => reportError(error),
			},
		);
	}

	function confirmDeactivate() {
		if (!toDeactivate) return;
		updateEmployee.mutate(
			{ id: toDeactivate.id, input: { active: false } },
			{
				onSuccess: () => {
					toast.success(`${toDeactivate.name} desactivado`);
					setToDeactivate(null);
				},
				onError: (error) => reportError(error),
			},
		);
	}

	function confirmDelete() {
		if (!toDelete) return;
		deleteEmployee.mutate(toDelete.id, {
			onSuccess: () => {
				toast.success(`Empleado "${toDelete.name}" eliminado`);
				setToDelete(null);
			},
			onError: (error) => reportError(error),
		});
	}

	const columns = getEmployeeColumns({
		onView: () => toast.info("Ficha de detalle disponible en #6"),
		onEdit: () => toast.info("Edición disponible en #6"),
		onToggleActive: toggleActive,
		onDelete: (employee) => setToDelete(employee),
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Empleados" }]} />
			<PageHeader
				title="Empleados"
				description="Listado, alta, edición y baja de empleados."
				actions={
					<Button
						onClick={() => toast.info("Alta de empleado disponible en #5")}
					>
						<UserPlus />
						Nuevo empleado
					</Button>
				}
			/>

			{isForbidden ? (
				<ForbiddenState description="No tienes permisos para ver el listado de empleados." />
			) : (
				<DataTable
					columns={columns}
					data={query.data?.employees ?? []}
					pagination={query.data?.pagination}
					isLoading={query.isPending}
					isFetching={query.isFetching}
					isError={query.isError}
					onRetry={() => query.refetch()}
					{...controls}
					getRowId={(employee) => employee.id}
					searchPlaceholder="Buscar por nombre, apellido o CI…"
					emptyTitle="Sin empleados"
					emptyDescription="Aún no hay empleados registrados."
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
				/>
			)}

			<ConfirmDialog
				open={toDeactivate !== null}
				onOpenChange={(open) => !open && setToDeactivate(null)}
				title="Desactivar empleado"
				description={
					toDeactivate
						? `¿Dar de baja a "${toDeactivate.name} ${toDeactivate.lastName}"? Podrás reactivarlo más tarde.`
						: undefined
				}
				confirmLabel="Desactivar"
				destructive
				loading={updateEmployee.isPending}
				onConfirm={confirmDeactivate}
			/>

			<ConfirmDialog
				open={toDelete !== null}
				onOpenChange={(open) => !open && setToDelete(null)}
				title="Eliminar empleado"
				description={
					toDelete
						? `¿Seguro que quieres eliminar a "${toDelete.name} ${toDelete.lastName}"? Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteEmployee.isPending}
				onConfirm={confirmDelete}
			/>
		</div>
	);
}
