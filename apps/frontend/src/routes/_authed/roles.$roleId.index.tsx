import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { NotFoundState } from "@/modules/common/components/partials/not-found-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { getErrorMessage, getErrorStatus } from "@/modules/common/lib/errors.ts";
import { requireResourceAccess } from "@/modules/permissions/lib/guard.ts";
import { permissionsQueries } from "@/modules/permissions/queries/permissions.ts";
import { RolePermissionsCard } from "@/modules/roles/components/role-permissions-card.tsx";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import type { Role } from "@/modules/roles/shared/types.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";

export const Route = createFileRoute("/_authed/roles/$roleId/")({
	beforeLoad: ({ context }) => requireResourceAccess(undefined, context),
	loader: ({ context: { queryClient }, params }) =>
		Promise.all([
			queryClient.prefetchQuery(rolesQueries.detail(params.roleId)),
			queryClient.prefetchQuery(permissionsQueries.byRole(params.roleId)),
			queryClient.prefetchQuery(permissionsQueries.catalog()),
			queryClient.prefetchQuery(systemsQueries.list({ limit: 100 })),
		]),
	component: RoleDetailPage,
});

function RoleDetailPage() {
	const { roleId } = Route.useParams();
	const query = useQuery(rolesQueries.detail(roleId));
	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Roles", to: "/roles" },
					{ label: query.data ? query.data.name : "Detalle" },
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Rol no encontrado"
					description="El rol que buscas no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/roles">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description={getErrorMessage(query.error)} />
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
				<RoleDetail role={query.data} />
			)}
		</div>
	);
}

function RoleDetail({ role }: { role: Role }) {
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const system = systemsQuery.data?.systems.find((s) => s.id === role.systemId);

	return (
		<>
			<PageHeader
				title={role.name}
				description={role.description ?? "Sin descripción."}
				actions={
					<>
						{system && (
							<Badge variant="outline" className="font-mono text-xs">
								{system.name} · {system.slug}
							</Badge>
						)}
						<Button asChild variant="outline">
							<Link to="/roles/$roleId/edit" params={{ roleId: role.id }}>
								<Pencil />
								Editar
							</Link>
						</Button>
					</>
				}
			/>
			<RolePermissionsCard roleId={role.id} />
		</>
	);
}
