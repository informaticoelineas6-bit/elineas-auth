import { deferOnClient } from "@/modules/common/lib/query.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
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
import { runBulk } from "@/modules/common/lib/bulk.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import type { ExportFormat } from "@/modules/common/lib/tabular.ts";
import { requireSystemManagerAccess } from "@/modules/permissions/lib/guard.ts";
import {
	permissionsQueries,
	useAssignPermission,
} from "@/modules/permissions/queries/permissions.ts";
import { getRoleColumns } from "@/modules/roles/lib/columns.tsx";
import { exportRoles } from "@/modules/roles/lib/import-export.ts";
import {
	mapRoleRows,
	type PermissionSpec,
} from "@/modules/roles/lib/import-validate.ts";
import { roleFiltersSchema } from "@/modules/roles/lib/validation.ts";
import {
	rolesQueries,
	useCreateRole,
	useDeleteRole,
	useExportRoles,
	useUpdateRole,
} from "@/modules/roles/queries/roles.ts";
import type { Role, RoleFilters } from "@/modules/roles/shared/types.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import type { System } from "@/modules/systems/shared/types.ts";

export const Route = createFileRoute("/_authed/roles/")({
	validateSearch: roleFiltersSchema,
	beforeLoad: ({ context }) => requireSystemManagerAccess(context),
	// Prefetch del listado + catálogo de sistemas (misma query key que el
	// componente) para calentar hover/SSR y evitar el waterfall montaje→fetch.
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, deps }) =>
		deferOnClient(
			Promise.all([
				queryClient.prefetchQuery(rolesQueries.list(deps)),
				queryClient.prefetchQuery(systemsQueries.list({ limit: 100 })),
			]),
		),
	component: RolesPage,
});

function RolesPage() {
	const navigate = useNavigate();
	const { filters, controls, setFilter } = useListControls<RoleFilters>();
	const query = useQuery(rolesQueries.list(filters));
	// Sistemas para resolver el nombre en la tabla y alimentar el filtro. Se
	// comparte por query cache (misma key en toda la app) y solo se pide una vez.
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const deleteRole = useDeleteRole();
	const createRole = useCreateRole();
	const updateRole = useUpdateRole();
	const assignPermission = useAssignPermission();
	const queryClient = useQueryClient();
	const exportRolesQuery = useExportRoles();
	const [importOpen, setImportOpen] = useState(false);

	const [target, setTarget] = useState<Role | null>(null);
	const [bulk, setBulk] = useState<{
		rows: Role[];
		clear: () => void;
	} | null>(null);

	const isForbidden = getErrorStatus(query.error) === 403;

	const systemsById = useMemo(
		() =>
			new Map<string, System>(
				(systemsQuery.data?.systems ?? []).map((system) => [system.id, system]),
			),
		[systemsQuery.data],
	);

	// Exporta TODOS los roles que cumplan los filtros activos (no solo la página
	// visible). Cada rol sale con el slug de su sistema, legible y estable.
	function handleExport(format: ExportFormat) {
		const { page: _page, limit: _limit, ...rest } = filters;
		exportRolesQuery.mutate(rest, {
			onSuccess: async (roles) => {
				if (roles.length === 0) {
					toast.info("No hay roles que exportar con estos filtros");
					return;
				}
				try {
					// Permisos por rol: el catálogo agrupado por sistema ya trae, por
					// permiso, los roles que lo tienen.
					const bySystem = await queryClient.fetchQuery(
						permissionsQueries.bySystem(),
					);
					const permissionsByRole = new Map<string, string[]>();
					for (const { permissions } of bySystem) {
						for (const perm of permissions) {
							for (const r of perm.roles) {
								const list = permissionsByRole.get(r.id) ?? [];
								list.push(`${perm.resource}:${perm.action}`);
								permissionsByRole.set(r.id, list);
							}
						}
					}
					await exportRoles(roles, systemsById, permissionsByRole, format);
					toast.success(`${roles.length} rol(es) exportado(s)`);
				} catch (error) {
					reportError(error, "No se pudo generar el archivo.");
				}
			},
			onError: (error) => reportError(error, "No se pudo exportar el listado."),
		});
	}

	// Asigna (creando si hace falta) cada permiso al rol, uno a uno. Solo añade:
	// nunca quita permisos que el rol ya tenga. Si alguno falla, lanza con el
	// detalle para que la fila salga como error (el rol ya está guardado).
	async function applyPermissions(
		roleId: string,
		systemId: string,
		permissions: PermissionSpec[],
	) {
		const failed: string[] = [];
		for (const { resource, action } of permissions) {
			try {
				await assignPermission.mutateAsync({
					systemId,
					roleId,
					resource,
					action,
				});
			} catch {
				failed.push(`${resource}:${action}`);
			}
		}
		if (failed.length > 0) {
			throw new Error(
				`Rol guardado, pero no se pudieron asignar: ${failed.join(", ")}`,
			);
		}
	}

	async function confirmBulk() {
		if (!bulk) return;
		const { ok, failed } = await runBulk(bulk.rows, (row) =>
			deleteRole.mutateAsync(row.id),
		);
		if (ok > 0) toast.success(`${ok} rol(es) eliminado(s)`);
		if (failed.length > 0) {
			// Un 409 es un rol con asignaciones que aún dependen de él.
			toast.error(`No se pudieron eliminar ${failed.length} rol(es)`, {
				description: getErrorMessage(failed[0].error),
			});
		}
		bulk.clear();
		setBulk(null);
	}

	function confirmDelete() {
		if (!target) return;
		deleteRole.mutate(target.id, {
			onSuccess: () => {
				toast.success(`Rol "${target.name}" eliminado`);
				setTarget(null);
			},
			onError: (error) => {
				// Un 409 significa que el IS rechazó el borrado por asignaciones que
				// aún dependen del rol: se explica con el mensaje del IS.
				if (getErrorStatus(error) === 409) {
					toast.error("No se pudo eliminar el rol", {
						description: getErrorMessage(error),
					});
					setTarget(null);
				} else {
					reportError(error);
				}
			},
		});
	}

	const columns = getRoleColumns({
		systemsById,
		onView: (role) =>
			navigate({ to: "/roles/$roleId", params: { roleId: role.id } }),
		onEdit: (role) =>
			navigate({ to: "/roles/$roleId/edit", params: { roleId: role.id } }),
		onDelete: (role) => setTarget(role),
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Roles" }]} />
			<PageHeader
				title="Roles"
				description="Define los roles disponibles por sistema."
				actions={
					<>
						<ExportMenu
							onExport={handleExport}
							pending={exportRolesQuery.isPending}
						/>
						<Button variant="outline" onClick={() => setImportOpen(true)}>
							<Upload />
							Importar
						</Button>
						<Button onClick={() => navigate({ to: "/roles/new" })}>
							<Plus />
							Nuevo rol
						</Button>
					</>
				}
			/>

			{isForbidden ? (
				<ForbiddenState description={getErrorMessage(query.error)} />
			) : (
				<DataTable
					columns={columns}
					data={query.data?.roles ?? []}
					pagination={query.data?.pagination}
					isLoading={query.isPending}
					isFetching={query.isFetching}
					isError={query.isError}
					onRetry={() => query.refetch()}
					{...controls}
					getRowId={(role) => role.id}
					searchPlaceholder="Buscar por nombre…"
					emptyTitle="Sin roles"
					emptyDescription="Aún no hay roles definidos."
					filters={
						<DataTableFilterSelect
							value={filters.systemId}
							onChange={(value) => setFilter("systemId", value)}
							placeholder="Sistema"
							allLabel="Todos los sistemas"
							options={(systemsQuery.data?.systems ?? []).map((system) => ({
								label: system.name,
								value: system.id,
							}))}
						/>
					}
					enableRowSelection
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
				open={bulk !== null}
				onOpenChange={(open) => !open && setBulk(null)}
				title="Eliminar roles"
				description={
					bulk
						? `¿Seguro que quieres eliminar ${bulk.rows.length} rol(es)? Los usuarios que los tengan asignados perderán el acceso que dependa de ellos. Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteRole.isPending}
				onConfirm={confirmBulk}
			/>

			<ConfirmDialog
				open={target !== null}
				onOpenChange={(open) => !open && setTarget(null)}
				title="Eliminar rol"
				description={
					target
						? `¿Seguro que quieres eliminar el rol "${target.name}"? Los usuarios que lo tengan asignado perderán el acceso que dependa de él. Esta acción no se puede deshacer.`
						: undefined
				}
				confirmLabel="Eliminar"
				destructive
				loading={deleteRole.isPending}
				onConfirm={confirmDelete}
			/>

			<ImportDialog
				open={importOpen}
				onOpenChange={setImportOpen}
				title="Importar roles"
				description={
					<>
						Sube un archivo CSV, JSON o Excel con las columnas{" "}
						<code>system</code> (slug del sistema), <code>name</code> y{" "}
						<code>description</code> y, opcionalmente, <code>permissions</code>{" "}
						(lista <code>recurso:acción</code> separada por <code>;</code>, p.
						ej. <code>users:read;users:write</code>). Los permisos que no existan
						se crean y se asignan al rol; los que el rol ya tenga no se quitan.
						Si una fila trae <code>id</code>, actualiza ese rol (el sistema no
						se puede cambiar); si no, crea uno nuevo.
					</>
				}
				mapRows={async (raw) => {
					// Todos los roles (no solo la página visible) para validar los ids.
					const allRoles = await exportRolesQuery.mutateAsync({});
					return mapRoleRows(
						raw,
						new Map(
							(systemsQuery.data?.systems ?? []).map((system) => [
								system.slug.toLowerCase(),
								system.id,
							]),
						),
						new Map(allRoles.map((r) => [r.id, r.systemId])),
					);
				}}
				onCreate={async ({ permissions, ...input }) => {
					const role = await createRole.mutateAsync(input);
					await applyPermissions(role.id, input.systemId, permissions);
				}}
				onUpdate={async (id, { permissions, systemId, ...input }) => {
					if (input.name !== undefined || input.description !== undefined) {
						await updateRole.mutateAsync({ id, input });
					}
					await applyPermissions(id, systemId, permissions);
				}}
			/>
		</div>
	);
}
