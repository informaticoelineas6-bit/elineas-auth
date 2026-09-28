import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import {
	getErrorMessage,
	getErrorStatus,
} from "@/modules/common/lib/errors.ts";
import { SystemPermissionsCard } from "@/modules/permissions/components/system-permissions-card.tsx";
import { requireResourceAccess } from "@/modules/permissions/lib/guard.ts";
import { permissionsQueries } from "@/modules/permissions/queries/permissions.ts";

export const Route = createFileRoute("/_authed/permissions/")({
	// Admin-only: cancela la navegación (no solo oculta el enlace) para quien
	// no tenga el rol admin. Mismo criterio que Systems/Roles.
	beforeLoad: ({ context }) => requireResourceAccess(undefined, context),
	loader: ({ context: { queryClient } }) =>
		queryClient.prefetchQuery(permissionsQueries.bySystem()),
	component: PermissionsPage,
});

function PermissionsPage() {
	const query = useQuery(permissionsQueries.bySystem());
	const isForbidden = getErrorStatus(query.error) === 403;

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Permisos" }]} />
			<PageHeader
				title="Permisos"
				description="Un sistema por card: crea permisos y asígnalos a sus roles sin pasar por la API."
			/>

			{isForbidden ? (
				<ForbiddenState description={getErrorMessage(query.error)} />
			) : query.isPending ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{Array.from({ length: 3 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: skeletons estáticos
						<Skeleton key={i} className="h-40 w-full" />
					))}
				</div>
			) : query.isError ? (
				<p className="text-sm text-destructive">
					No se pudieron cargar los permisos.{" "}
					<button
						type="button"
						className="underline underline-offset-2"
						onClick={() => query.refetch()}
					>
						Reintentar
					</button>
				</p>
			) : (query.data ?? []).length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Aún no hay sistemas registrados.
				</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{(query.data ?? []).map((entry) => (
						<SystemPermissionsCard key={entry.system.id} entry={entry} />
					))}
				</div>
			)}
		</div>
	);
}
