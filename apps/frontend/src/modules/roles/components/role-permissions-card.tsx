import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { getErrorMessage, reportError } from "@/modules/common/lib/errors.ts";
import {
	permissionsQueries,
	useAssignPermissionToRole,
	useUnassignPermissionFromRole,
} from "@/modules/permissions/queries/permissions.ts";
import type { CatalogPermission } from "@/modules/permissions/shared/types.ts";

// Permisos del rol: todo el catálogo agrupado por recurso, con un checkbox por
// permiso. Marcar/desmarcar asigna o quita ese permiso del rol al instante
// (PUT/DELETE /api/permissions/:id/roles/:roleId); no toca el catálogo.
export function RolePermissionsCard({ roleId }: { roleId: string }) {
	const catalog = useQuery(permissionsQueries.catalog());
	const assigned = useQuery(permissionsQueries.byRole(roleId));
	const assign = useAssignPermissionToRole();
	const unassign = useUnassignPermissionFromRole();
	const [search, setSearch] = useState("");
	const [pendingId, setPendingId] = useState<string | null>(null);

	const assignedIds = useMemo(
		() => new Set((assigned.data ?? []).map((p) => p.id)),
		[assigned.data],
	);

	const groups = useMemo(() => {
		const term = search.trim().toLowerCase();
		const byResource = new Map<string, CatalogPermission[]>();
		for (const p of catalog.data ?? []) {
			const label = `${p.resource}:${p.action}`.toLowerCase();
			if (term && !label.includes(term)) continue;
			const list = byResource.get(p.resource) ?? [];
			list.push(p);
			byResource.set(p.resource, list);
		}
		return Array.from(byResource.entries());
	}, [catalog.data, search]);

	function toggle(permission: CatalogPermission, checked: boolean) {
		setPendingId(permission.id);
		const mutation = checked ? assign : unassign;
		mutation.mutate(
			{ id: permission.id, roleId },
			{
				onError: (error) => reportError(error),
				onSettled: () => setPendingId(null),
			},
		);
	}

	const error = catalog.error ?? assigned.error;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Permisos</CardTitle>
				<CardDescription>
					{assigned.data
						? `${assigned.data.length} de ${catalog.data?.length ?? "…"} permisos asignados. `
						: ""}
					Los cambios se aplican al marcar o desmarcar. El rol admin del
					sistema auth siempre pasa como comodín, sin necesitar permisos.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{error ? (
					<p className="text-sm text-destructive">
						{getErrorMessage(error, "No se pudieron cargar los permisos.")}{" "}
						<button
							type="button"
							className="underline underline-offset-2"
							onClick={() => {
								catalog.refetch();
								assigned.refetch();
							}}
						>
							Reintentar
						</button>
					</p>
				) : catalog.isPending || assigned.isPending ? (
					<div className="space-y-2">
						<Skeleton className="h-9 w-full max-w-sm" />
						<Skeleton className="h-24 w-full" />
					</div>
				) : (
					<>
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Buscar permiso (recurso o acción)…"
							className="max-w-sm"
						/>
						{groups.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								{catalog.data?.length === 0
									? "Aún no hay permisos en el catálogo."
									: "Ningún permiso coincide con la búsqueda."}
							</p>
						) : (
							<div className="space-y-5">
								{groups.map(([resource, permissions]) => (
									<section key={resource} className="space-y-2">
										<h3 className="flex items-center gap-2 text-sm font-medium">
											<span className="font-mono">{resource}</span>
											<Badge variant="secondary">
												{permissions.filter((p) => assignedIds.has(p.id)).length}
												/{permissions.length}
											</Badge>
										</h3>
										<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
											{permissions.map((p) => {
												const inputId = `perm-${p.id}`;
												return (
													<li
														key={p.id}
														className="flex items-start gap-2 rounded-md border p-2.5"
													>
														<Checkbox
															id={inputId}
															checked={assignedIds.has(p.id)}
															disabled={pendingId === p.id}
															onCheckedChange={(value) =>
																toggle(p, value === true)
															}
															className="mt-0.5"
														/>
														<label
															htmlFor={inputId}
															className="min-w-0 flex-1 cursor-pointer text-sm"
														>
															<span className="font-mono">{p.action}</span>
															{p.description && (
																<span className="block text-xs text-muted-foreground">
																	{p.description}
																</span>
															)}
														</label>
													</li>
												);
											})}
										</ul>
									</section>
								))}
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
