import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { NotFoundState } from "@/modules/common/components/partials/not-found-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { formatDate } from "@/modules/common/lib/format.ts";
import { EmployeeRolesCard } from "@/modules/employees/components/employee-roles-card.tsx";
import {
	employeesQueries,
	useDeleteEmployee,
	useUpdateEmployee,
} from "@/modules/employees/queries/employees.ts";
import type { Employee } from "@/modules/employees/shared/types.ts";

export const Route = createFileRoute("/_authed/employees/$employeeId/")({
	component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
	const { employeeId } = Route.useParams();
	const query = useQuery(employeesQueries.detail(employeeId));

	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Empleados", to: "/employees" },
					{
						label: query.data
							? `${query.data.name} ${query.data.lastName}`
							: "Detalle",
					},
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Empleado no encontrado"
					description="El empleado que buscas no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/employees">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description="No tienes permisos para ver esta ficha de empleado." />
			) : query.isError ? (
				<NotFoundState
					title="No se pudo cargar la ficha"
					description={getErrorMessage(query.error)}
					action={
						<Button variant="outline" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					}
				/>
			) : query.isPending ? (
				<EmployeeDetailSkeleton />
			) : (
				<EmployeeDetail employee={query.data} />
			)}
		</div>
	);
}

function EmployeeDetail({ employee }: { employee: Employee }) {
	const navigate = useNavigate();
	const updateEmployee = useUpdateEmployee();
	const deleteEmployee = useDeleteEmployee();

	// Confirmaciones para las acciones destructivas/sensibles (mismo criterio que
	// el listado): activar es inmediato, desactivar y eliminar piden confirmación.
	const [confirming, setConfirming] = useState<"deactivate" | "delete" | null>(
		null,
	);

	function toggleActive() {
		if (employee.active) {
			setConfirming("deactivate");
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
		updateEmployee.mutate(
			{ id: employee.id, input: { active: false } },
			{
				onSuccess: () => {
					toast.success(`${employee.name} desactivado`);
					setConfirming(null);
				},
				onError: (error) => reportError(error),
			},
		);
	}

	function confirmDelete() {
		deleteEmployee.mutate(employee.id, {
			onSuccess: () => {
				toast.success(`Empleado "${employee.name}" eliminado`);
				navigate({ to: "/employees" });
			},
			onError: (error) => {
				// Un 409 significa que el IS rechazó la eliminación (p. ej. otro
				// recurso aún la referencia): se explica con el mensaje del IS.
				if (getErrorStatus(error) === 409) {
					toast.error("No se pudo eliminar el empleado", {
						description: getErrorMessage(error),
					});
					setConfirming(null);
				} else {
					reportError(error);
				}
			},
		});
	}

	return (
		<>
			<PageHeader
				title={`${employee.name} ${employee.lastName}`}
				description={`CI ${employee.ci}`}
				actions={
					<>
						<Button
							onClick={() =>
								navigate({
									to: "/employees/$employeeId/edit",
									params: { employeeId: employee.id },
								})
							}
						>
							<Pencil />
							Editar
						</Button>
						<Button variant="outline" onClick={toggleActive}>
							{employee.active ? <PowerOff /> : <Power />}
							{employee.active ? "Desactivar" : "Activar"}
						</Button>
						<Button
							variant="destructive"
							onClick={() => setConfirming("delete")}
						>
							<Trash2 />
							Eliminar
						</Button>
					</>
				}
			/>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Datos personales</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<DetailItem label="Nombre" value={employee.name} />
							<DetailItem label="Apellidos" value={employee.lastName} />
							<DetailItem label="CI" value={employee.ci} />
							<DetailItem
								label="Fecha de nacimiento"
								value={formatDate(employee.birthday)}
							/>
							<DetailItem label="Teléfono" value={employee.phoneNumber} />
							<DetailItem label="Dirección" value={employee.address} />
						</dl>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Situación laboral</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<DetailItem
								label="Estado"
								value={
									<Badge variant={employee.active ? "default" : "secondary"}>
										{employee.active ? "Activo" : "Inactivo"}
									</Badge>
								}
							/>
							<DetailItem
								label="Fecha de alta"
								value={formatDate(employee.inDate)}
							/>
							<DetailItem
								label="Fecha de baja"
								value={formatDate(employee.outDate)}
							/>
							<DetailItem
								label="Creado"
								value={formatDate(employee.createdAt)}
							/>
							<DetailItem
								label="Actualizado"
								value={formatDate(employee.updatedAt)}
							/>
						</dl>
					</CardContent>
				</Card>

				<EmployeeRolesCard
					userId={employee.userId}
					userLabel={`${employee.name} ${employee.lastName}`}
				/>
			</div>

			<ConfirmDialog
				open={confirming === "deactivate"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Desactivar empleado"
				description={`¿Dar de baja a "${employee.name} ${employee.lastName}"? Podrás reactivarlo más tarde.`}
				confirmLabel="Desactivar"
				destructive
				loading={updateEmployee.isPending}
				onConfirm={confirmDeactivate}
			/>

			<ConfirmDialog
				open={confirming === "delete"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Eliminar empleado"
				description={`Se eliminará de forma permanente la ficha de "${employee.name} ${employee.lastName}". La cuenta de usuario enlazada y sus asignaciones de rol no se eliminan. Esta acción no se puede deshacer.`}
				confirmLabel="Eliminar"
				destructive
				loading={deleteEmployee.isPending}
				onConfirm={confirmDelete}
			/>
		</>
	);
}

function DetailItem({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="space-y-1">
			<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</dt>
			<dd className="text-sm text-foreground">
				{value || <span className="text-muted-foreground">—</span>}
			</dd>
		</div>
	);
}

function EmployeeDetailSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-4 w-32" />
			</div>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Skeleton className="h-56 rounded-xl" />
				<Skeleton className="h-56 rounded-xl" />
				<Skeleton className="h-32 rounded-xl" />
			</div>
		</div>
	);
}
