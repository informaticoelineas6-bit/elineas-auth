import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { CopyButton } from "@/modules/common/components/partials/copy-button.tsx";
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
import { SystemRolesPanel } from "@/modules/systems/components/system-roles-panel.tsx";
import {
	systemsQueries,
	useDeleteSystem,
	useUpdateSystem,
} from "@/modules/systems/queries/systems.ts";
import type { System } from "@/modules/systems/shared/types.ts";

export const Route = createFileRoute("/_authed/systems/$systemId/")({
	component: SystemDetailPage,
});

function SystemDetailPage() {
	const { systemId } = Route.useParams();
	const query = useQuery(systemsQueries.detail(systemId));

	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Sistemas", to: "/systems" },
					{ label: query.data ? query.data.name : "Detalle" },
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Sistema no encontrado"
					description="El sistema que buscas no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/systems">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description="No tienes permisos para ver este sistema." />
			) : query.isError ? (
				<NotFoundState
					title="No se pudo cargar el sistema"
					description={getErrorMessage(query.error)}
					action={
						<Button variant="outline" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					}
				/>
			) : query.isPending ? (
				<SystemDetailSkeleton />
			) : (
				<SystemDetail system={query.data} />
			)}
		</div>
	);
}

function SystemDetail({ system }: { system: System }) {
	const navigate = useNavigate();
	const updateSystem = useUpdateSystem();
	const deleteSystem = useDeleteSystem();

	const [confirming, setConfirming] = useState<"deactivate" | "delete" | null>(
		null,
	);

	// Activar es inmediato; desactivar pide confirmación (rechaza los logins).
	function toggleActive() {
		if (system.active) {
			setConfirming("deactivate");
			return;
		}
		updateSystem.mutate(
			{ id: system.id, input: { active: true } },
			{
				onSuccess: () => toast.success(`"${system.name}" activado`),
				onError: (error) => reportError(error),
			},
		);
	}

	function confirmDeactivate() {
		updateSystem.mutate(
			{ id: system.id, input: { active: false } },
			{
				onSuccess: () => {
					toast.success(`"${system.name}" desactivado`);
					setConfirming(null);
				},
				onError: (error) => reportError(error),
			},
		);
	}

	function confirmDelete() {
		deleteSystem.mutate(system.id, {
			onSuccess: () => {
				toast.success(`Sistema "${system.name}" eliminado`);
				navigate({ to: "/systems" });
			},
			onError: (error) => {
				// Un 409 significa que el IS rechazó la eliminación (dependencias).
				if (getErrorStatus(error) === 409) {
					toast.error("No se pudo eliminar el sistema", {
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
				title={system.name}
				actions={
					<>
						<Button
							onClick={() =>
								navigate({
									to: "/systems/$systemId/edit",
									params: { systemId: system.id },
								})
							}
						>
							<Pencil />
							Editar
						</Button>
						<Button variant="outline" onClick={toggleActive}>
							{system.active ? <PowerOff /> : <Power />}
							{system.active ? "Desactivar" : "Activar"}
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
						<CardTitle>Datos del sistema</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<DetailItem label="Nombre" value={system.name} />
							<DetailItem
								label="Slug"
								value={
									<span className="flex items-center gap-1">
										<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
											{system.slug}
										</code>
										<CopyButton
											value={system.slug}
											label={`Copiar slug "${system.slug}"`}
										/>
									</span>
								}
							/>
							<DetailItem
								label="Estado"
								value={
									<Badge variant={system.active ? "default" : "secondary"}>
										{system.active ? "Activo" : "Inactivo"}
									</Badge>
								}
							/>
							<DetailItem label="Creado" value={formatDate(system.createdAt)} />
							<DetailItem
								label="Actualizado"
								value={formatDate(system.updatedAt)}
							/>
							<DetailItem
								label="Descripción"
								value={system.description}
								className="sm:col-span-2"
							/>
						</dl>
					</CardContent>
				</Card>

				<SystemRolesPanel systemId={system.id} />
			</div>

			<ConfirmDialog
				open={confirming === "deactivate"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Desactivar sistema"
				description={`¿Desactivar "${system.name}"? Las aplicaciones que usan su slug dejarán de poder iniciar sesión hasta que lo reactives.`}
				confirmLabel="Desactivar"
				destructive
				loading={updateSystem.isPending}
				onConfirm={confirmDeactivate}
			/>

			<ConfirmDialog
				open={confirming === "delete"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title="Eliminar sistema"
				description={`Se eliminará de forma permanente "${system.name}". Los roles y asignaciones que dependan de él dejarán de funcionar. Esta acción no se puede deshacer.`}
				confirmLabel="Eliminar"
				destructive
				loading={deleteSystem.isPending}
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

function SystemDetailSkeleton() {
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
