import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { DataTableFilterSelect } from "@/modules/common/components/data-table";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import {
	getErrorMessage,
	getErrorStatus,
} from "@/modules/common/lib/errors.ts";
import { useDebouncedValue } from "@/modules/common/lib/use-debounced-value.ts";
import { SystemPermissionsCard } from "@/modules/permissions/components/system-permissions-card.tsx";
import { requireResourceAccess } from "@/modules/permissions/lib/guard.ts";
import { permissionsQueries } from "@/modules/permissions/queries/permissions.ts";
import type { SystemPermissions } from "@/modules/permissions/shared/types.ts";

export const Route = createFileRoute("/_authed/permissions/")({
	// Admin-only: cancela la navegación (no solo oculta el enlace) para quien
	// no tenga el rol admin. Mismo criterio que Systems/Roles.
	beforeLoad: ({ context }) => requireResourceAccess(undefined, context),
	loader: ({ context: { queryClient } }) =>
		queryClient.prefetchQuery(permissionsQueries.bySystem()),
	component: PermissionsPage,
});

// Filtra client-side sobre el agrupado por sistema (ya viene completo del
// backend, no paginado): `systemId` deja solo esa card, `search` deja solo
// los permisos ("resource:action" o descripción) que coincidan y oculta las
// cards que se quedan sin ninguno.
function filterEntries(
	entries: SystemPermissions[],
	systemId: string | undefined,
	search: string,
): SystemPermissions[] {
	const term = search.trim().toLowerCase();
	return entries
		.filter((entry) => !systemId || entry.system.id === systemId)
		.map((entry) => {
			if (!term) return entry;
			return {
				...entry,
				permissions: entry.permissions.filter(
					(permission) =>
						`${permission.resource}:${permission.action}`
							.toLowerCase()
							.includes(term) ||
						(permission.description ?? "").toLowerCase().includes(term),
				),
			};
		})
		.filter((entry) => !term || entry.permissions.length > 0);
}

function PermissionsPage() {
	const query = useQuery(permissionsQueries.bySystem());
	const isForbidden = getErrorStatus(query.error) === 403;

	const [systemId, setSystemId] = useState<string | undefined>(undefined);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search);

	const entries = query.data ?? [];
	const systemOptions = entries.map(({ system }) => ({
		label: system.name,
		value: system.id,
	}));
	const filteredEntries = filterEntries(entries, systemId, debouncedSearch);

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
			) : entries.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Aún no hay sistemas registrados.
				</p>
			) : (
				<>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<div className="relative w-full sm:max-w-xs">
							<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="search"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Buscar por recurso:acción o descripción…"
								className="pl-8"
							/>
						</div>
						<DataTableFilterSelect
							value={systemId}
							onChange={setSystemId}
							options={systemOptions}
							placeholder="Sistema"
							allLabel="Todos los sistemas"
						/>
					</div>

					{filteredEntries.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Ningún permiso coincide con el filtro.
						</p>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredEntries.map((entry) => (
								<SystemPermissionsCard key={entry.system.id} entry={entry} />
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
