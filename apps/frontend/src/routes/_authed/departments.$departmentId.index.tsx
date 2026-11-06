import { hasPermission } from "@elineas/auth-contracts";
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
import { deferOnClient } from "@/modules/common/lib/query.ts";
import { DepartmentMembersCard } from "@/modules/departments/components/department-members-card.tsx";
import {
	departmentsQueries,
	useDeleteDepartment,
	useUpdateDepartment,
} from "@/modules/departments/queries/departments.ts";
import type { Department } from "@/modules/departments/shared/types.ts";
import { requireResourceAccess } from "@/modules/permissions/lib/guard.ts";

export const Route = createFileRoute("/_authed/departments/$departmentId/")({
	beforeLoad: ({ context }) => requireResourceAccess("departments", context),
	// Prefetch del detalle (misma query key) para calentar hover/SSR.
	loader: ({ context: { queryClient }, params }) =>
		deferOnClient(
			queryClient.prefetchQuery(departmentsQueries.detail(params.departmentId)),
		),
	component: DepartmentDetailPage,
});

function DepartmentDetailPage() {
	const { departmentId } = Route.useParams();
	const query = useQuery(departmentsQueries.detail(departmentId));

	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Departamentos", to: "/departments" },
					{ label: query.data ? query.data.name : "Detalle" },
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Departamento no encontrado"
					description="El departamento que buscas no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/departments">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description={getErrorMessage(query.error)} />
			) : query.isError ? (
				<NotFoundState
					title="No se pudo cargar el departamento"
					description={getErrorMessage(query.error)}
					action={
						<Button variant="outline" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					}
				/>
			) : query.isPending ? (
				<DepartmentDetailSkeleton />
			) : (
				<DepartmentDetail department={query.data} />
			)}
		</div>
	);
}

function DepartmentDetail({ department }: { department: Department }) {
	const navigate = useNavigate();
	const { isAdmin, permissions } = Route.useRouteContext();
	const access = { isAdmin, permissions };
	const canWrite = hasPermission("departments", "write", access);
	const canDelete = hasPermission("departments", "delete", access);
	const updateDepartment = useUpdateDepartment();
	const deleteDepartment = useDeleteDepartment();
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	function toggleActive() {
		updateDepartment.mutate(
			{ id: department.id, input: { active: !department.active } },
			{
				onSuccess: () =>
					toast.success(
						`"${department.name}" ${department.active ? "desactivado" : "activado"}`,
					),
				onError: (error) => reportError(error),
			},
		);
	}

	function confirmDelete() {
		deleteDepartment.mutate(department.id, {
			onSuccess: () => {
				toast.success(`Departamento "${department.name}" eliminado`);
				navigate({ to: "/departments" });
			},
			onError: (error) => reportError(error),
		});
	}

	return (
		<>
			<PageHeader
				title={department.name}
				actions={
					<>
						{canWrite && (
							<>
								<Button
									onClick={() =>
										navigate({
											to: "/departments/$departmentId/edit",
											params: { departmentId: department.id },
										})
									}
								>
									<Pencil />
									Editar
								</Button>
								<Button variant="outline" onClick={toggleActive}>
									{department.active ? <PowerOff /> : <Power />}
									{department.active ? "Desactivar" : "Activar"}
								</Button>
							</>
						)}
						{canDelete && (
							<Button
								variant="destructive"
								onClick={() => setConfirmingDelete(true)}
							>
								<Trash2 />
								Eliminar
							</Button>
						)}
					</>
				}
			/>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Datos del departamento</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<DetailItem label="Nombre" value={department.name} />
							<DetailItem
								label="Estado"
								value={
									<Badge variant={department.active ? "default" : "secondary"}>
										{department.active ? "Activo" : "Inactivo"}
									</Badge>
								}
							/>
							<DetailItem
								label="Creado"
								value={formatDate(department.createdAt)}
							/>
							<DetailItem
								label="Descripción"
								value={department.description}
								className="sm:col-span-3"
							/>
						</dl>
					</CardContent>
				</Card>

				<DepartmentMembersCard
					departmentId={department.id}
					departmentName={department.name}
					canWrite={canWrite}
				/>
			</div>

			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title="Eliminar departamento"
				description={`Se eliminará de forma permanente "${department.name}". Sus miembros quedarán sin este departamento. Esta acción no se puede deshacer.`}
				confirmLabel="Eliminar"
				destructive
				loading={deleteDepartment.isPending}
				onConfirm={confirmDelete}
			/>
		</>
	);
}

function DetailItem({
	label,
	value,
	className,
}: {
	label: string;
	value: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</dt>
			<dd className="mt-1 text-sm text-foreground">
				{value || <span className="text-muted-foreground">—</span>}
			</dd>
		</div>
	);
}

function DepartmentDetailSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-8 w-56" />
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Skeleton className="h-64 rounded-xl" />
				<Skeleton className="h-64 rounded-xl" />
			</div>
		</div>
	);
}
