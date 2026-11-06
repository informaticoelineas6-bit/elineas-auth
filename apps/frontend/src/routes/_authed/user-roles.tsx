import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	LayoutGrid,
	Mail,
	Table2,
	Trash2,
	TriangleAlert,
	UserPlus,
	Users,
	UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	DataTable,
	DataTableFilterSelect,
	useListControls,
} from "@/modules/common/components/data-table";
import { ExportMenu } from "@/modules/common/components/import-export/export-menu.tsx";
import { Combobox } from "@/modules/common/components/partials/combobox.tsx";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@/modules/common/components/ui/tabs.tsx";
import { runBulk } from "@/modules/common/lib/bulk.ts";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { deferOnClient } from "@/modules/common/lib/query.ts";
import type { ExportFormat } from "@/modules/common/lib/tabular.ts";
import { employeesQueries } from "@/modules/employees/queries/employees.ts";
import { requireSystemManagerAccess } from "@/modules/permissions/lib/guard.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import type { Role } from "@/modules/roles/shared/types.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import type { System } from "@/modules/systems/shared/types.ts";
import { AssignRoleDialog } from "@/modules/user-roles/components/assign-role-dialog.tsx";
import { BulkAssignRoleDialog } from "@/modules/user-roles/components/bulk-assign-role-dialog.tsx";
import { InviteUserDialog } from "@/modules/user-roles/components/invite-user-dialog.tsx";
import { useUserDirectory } from "@/modules/user-roles/lib/use-user-directory.ts";
import { UserRolesCards } from "@/modules/user-roles/components/user-roles-cards.tsx";
import {
	getUserRoleColumns,
	type ResolvedUser,
} from "@/modules/user-roles/lib/columns.tsx";
import { exportUserRoles } from "@/modules/user-roles/lib/import-export.ts";
import { userRoleFiltersSchema } from "@/modules/user-roles/lib/validation.ts";
import {
	useDeleteUserRole,
	useExportUserRoles,
	userRolesQueries,
} from "@/modules/user-roles/queries/user-roles.ts";
import type {
	UserRoleDetail,
	UserRoleFilters,
} from "@/modules/user-roles/shared/types.ts";

// Nombre del rol que concede acceso a la consola (coincide con ADMIN_ROLE_NAME
// del IS, ver modules/admin/actions/admin.ts).
const ADMIN_ROLE_NAME = "admin";

export const Route = createFileRoute("/_authed/user-roles")({
	validateSearch: userRoleFiltersSchema,
	beforeLoad: ({ context }) => requireSystemManagerAccess(context),
	// Prefetch del listado + las 3 fuentes (empleados/roles/sistemas) que la
	// página usa para resolver ids, con las mismas query keys, para calentar
	// hover/SSR y evitar el waterfall montaje→fetch.
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient, isAdmin }, deps }) =>
		deferOnClient(
			Promise.all([
				queryClient.prefetchQuery(userRolesQueries.list(deps)),
				// Solo el superadmin puede listar empleados; un admin de sistema
				// resuelve los nombres con lo que ya trae cada asignación.
				isAdmin &&
					queryClient.prefetchQuery(employeesQueries.list({ limit: 100 })),
				queryClient.prefetchQuery(rolesQueries.list({ limit: 100 })),
				queryClient.prefetchQuery(systemsQueries.list({ limit: 100 })),
			]),
		),
	component: UserRolesPage,
});

function UserRolesPage() {
	// Roles del usuario actual en el sistema de la consola (auth): de aquí se
	// deriva el id del sistema auth para avisar al revocar un admin de esa consola
	// (vacío para un admin de otro sistema, que no tiene rol en `auth`).
	const { roles: myRoles, isAdmin, managedSystems } = Route.useRouteContext();
	const authSystemId = myRoles[0]?.system.id;

	const {
		filters: { assign, systemSlug, ...filters },
		controls,
		setFilter,
		setFilters,
	} = useListControls<UserRoleFilters>();
	const view = filters.view ?? "table";
	const isTable = view === "table";
	// Filtros sin paginación ni vista: los usan las vistas de tarjetas, que
	// cargan todas las asignaciones y agrupan en el cliente.
	const {
		page: _page,
		limit: _limit,
		view: _view,
		sortBy: _sortBy,
		sortDir: _sortDir,
		...baseFilters
	} = filters;
	const query = useQuery({
		...userRolesQueries.list(filters),
		enabled: isTable,
	});
	const allQuery = useQuery({
		...userRolesQueries.allFiltered(baseFilters),
		enabled: !isTable,
	});
	// Fuentes para resolver ids y alimentar los filtros. Compartidas por query
	// cache (misma key en toda la app); solo se piden una vez.
	// Empleados: solo el superadmin puede listarlos. Aportan el nombre completo
	// del empleado; sin ellos cada fila usa el usuario que ya trae la asignación.
	const employeesQuery = useQuery({
		...employeesQueries.list({ limit: 100 }),
		enabled: isAdmin,
	});
	// Usuarios para el filtro: directorio con búsqueda en el servidor.
	const directory = useUserDirectory({ ensureId: filters.userId });
	const rolesQuery = useQuery(rolesQueries.list({ limit: 100 }));
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const deleteUserRole = useDeleteUserRole();
	const exportUserRolesQuery = useExportUserRoles();

	const [assignOpen, setAssignOpen] = useState(false);
	const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
	const [inviteOpen, setInviteOpen] = useState(false);
	// Sistema fijado en el diálogo "Asignar rol" (enlace directo con systemSlug).
	const [lockedSystemId, setLockedSystemId] = useState<string | undefined>();
	// `?assign` abre el diálogo con el usuario del filtro preseleccionado y se
	// limpia de la URL para no reabrirlo al recargar.
	useEffect(() => {
		if (!assign || systemSlug) return;
		setAssignOpen(true);
		setFilter("assign", undefined);
	}, [assign, systemSlug, setFilter]);
	// Enlace directo `/user-roles?systemSlug=pos&assign=1`: resuelve el slug entre
	// los sistemas que el usuario administra, filtra el listado por él y (con
	// `assign`) abre el diálogo con ese sistema fijado. Todo en UNA navegación que
	// además limpia los parámetros transitorios. Un slug desconocido o que no
	// administra avisa y se descarta.
	useEffect(() => {
		if (!systemSlug) return;
		const target = managedSystems.find((system) => system.slug === systemSlug);
		if (!target) {
			toast.error(`No administras ningún sistema con el identificador «${systemSlug}».`);
			setFilters({ systemSlug: undefined, assign: undefined });
			return;
		}
		setFilters({
			systemId: target.id,
			systemSlug: undefined,
			assign: undefined,
		});
		if (assign) {
			setLockedSystemId(target.id);
			setAssignOpen(true);
		}
	}, [systemSlug, assign, managedSystems, setFilters]);
	const [toRevoke, setToRevoke] = useState<UserRoleDetail | null>(null);
	const [bulk, setBulk] = useState<{
		rows: UserRoleDetail[];
		clear: () => void;
	} | null>(null);

	const activeError = isTable ? query.error : allQuery.error;
	const isForbidden = getErrorStatus(activeError) === 403;

	// userId (cuenta) → nombre/email, resuelto desde el empleado enlazado.
	const usersById = useMemo(() => {
		const map = new Map<string, ResolvedUser>();
		for (const employee of employeesQuery.data?.employees ?? []) {
			if (employee.userId && employee.user) {
				map.set(employee.userId, {
					name: `${employee.name} ${employee.lastName}`,
					email: employee.user.email,
				});
			}
		}
		return map;
	}, [employeesQuery.data]);

	const rolesById = useMemo(
		() =>
			new Map<string, Role>(
				(rolesQuery.data?.roles ?? []).map((role) => [role.id, role]),
			),
		[rolesQuery.data],
	);
	const systemsById = useMemo(
		() =>
			new Map<string, System>(
				(systemsQuery.data?.systems ?? []).map((system) => [system.id, system]),
			),
		[systemsQuery.data],
	);

	const userOptions = directory.optionsFor(filters.userId ? [filters.userId] : []);
	const roleOptions = (rolesQuery.data?.roles ?? []).map((role) => {
		const system = systemsById.get(role.systemId);
		return {
			value: role.id,
			label: role.name,
			description: system?.name,
		};
	});

	// ¿La asignación es el rol admin de algún sistema? Revocarlo puede dejar a
	// alguien (a uno mismo o al sistema) sin quien lo administre. En el sistema de
	// la consola (auth) el aviso lo distingue porque afecta a toda la consola.
	function isSystemAdminAssignment(userRole: UserRoleDetail): boolean {
		const role = rolesById.get(userRole.roleId);
		const name = role?.name ?? userRole.role?.name;
		return name?.toLowerCase() === ADMIN_ROLE_NAME;
	}

	function isAuthAdminAssignment(userRole: UserRoleDetail): boolean {
		const role = rolesById.get(userRole.roleId);
		return Boolean(
			role &&
				authSystemId &&
				role.systemId === authSystemId &&
				role.name.toLowerCase() === ADMIN_ROLE_NAME,
		);
	}

	async function confirmBulk() {
		if (!bulk) return;
		const { ok, failed } = await runBulk(bulk.rows, (row) =>
			deleteUserRole.mutateAsync(row.id),
		);
		if (ok > 0) toast.success(`${ok} asignación(es) revocada(s)`);
		if (failed.length > 0) {
			toast.error(`No se pudieron revocar ${failed.length} asignación(es)`, {
				description: getErrorMessage(failed[0].error),
			});
		}
		bulk.clear();
		setBulk(null);
	}

	function confirmRevoke() {
		if (!toRevoke) return;
		deleteUserRole.mutate(toRevoke.id, {
			onSuccess: () => {
				toast.success("Asignación revocada");
				setToRevoke(null);
			},
			onError: (error) => {
				if (getErrorStatus(error) === 409) {
					toast.error("No se pudo revocar la asignación", {
						description: getErrorMessage(error),
					});
					setToRevoke(null);
				} else {
					reportError(error);
				}
			},
		});
	}

	// Exporta TODAS las asignaciones que cumplan los filtros activos (no solo la
	// página visible).
	function handleExport(format: ExportFormat) {
		exportUserRolesQuery.mutate(
			{ ...baseFilters, sortBy: filters.sortBy, sortDir: filters.sortDir },
			{
				onSuccess: async (userRoles) => {
					if (userRoles.length === 0) {
						toast.info("No hay asignaciones que exportar con estos filtros");
						return;
					}
					try {
						await exportUserRoles(userRoles, usersById, format);
						toast.success(`${userRoles.length} asignación(es) exportada(s)`);
					} catch (error) {
						reportError(error, "No se pudo generar el archivo.");
					}
				},
				onError: (error) =>
					reportError(error, "No se pudo exportar el listado."),
			},
		);
	}

	const columns = getUserRoleColumns({
		usersById,
		rolesById,
		systemsById,
		onRevoke: (userRole) => setToRevoke(userRole),
	});

	// Datos resueltos de la asignación en revocación, para el texto de confirmación.
	const revokeUser = toRevoke
		? (usersById.get(toRevoke.userId) ?? toRevoke.user ?? undefined)
		: undefined;
	const revokeRole = toRevoke ? rolesById.get(toRevoke.roleId) : undefined;
	const revokeSystem = revokeRole
		? systemsById.get(revokeRole.systemId)
		: undefined;
	const revokeIsAuthAdmin = toRevoke ? isAuthAdminAssignment(toRevoke) : false;
	const revokeIsSystemAdmin = toRevoke
		? isSystemAdminAssignment(toRevoke) && !revokeIsAuthAdmin
		: false;

	const filterControls = (
		<>
			<Combobox
				className="w-56"
				value={filters.userId}
				onChange={(value) => setFilter("userId", value)}
				options={userOptions}
				onSearchChange={directory.setSearch}
				loading={directory.isSearching}
				placeholder="Usuario"
				searchPlaceholder="Buscar por nombre o email…"
				emptyText="Sin usuarios"
				allowClear
				clearLabel="Todos los usuarios"
			/>
			<Combobox
				className="w-56"
				value={filters.roleId}
				onChange={(value) => setFilter("roleId", value)}
				options={roleOptions}
				placeholder="Rol"
				searchPlaceholder="Buscar rol…"
				emptyText="Sin roles"
				allowClear
				clearLabel="Todos los roles"
			/>
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
		</>
	);

	const viewSwitch = (
		<Tabs
			value={view}
			onValueChange={(value) =>
				setFilter("view", value === "table" ? undefined : value)
			}
		>
			<TabsList>
				<TabsTrigger value="table">
					<Table2 />
					Tabla
				</TabsTrigger>
				<TabsTrigger value="systems">
					<LayoutGrid />
					Por sistema
				</TabsTrigger>
				<TabsTrigger value="users">
					<Users />
					Por usuario
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Asignaciones" }]} />
			<PageHeader
				title="Asignaciones"
				description="Asigna y revoca roles a los usuarios. Sin al menos un rol, un usuario no puede iniciar sesión en ningún sistema."
				actions={
					<>
						<ExportMenu
							onExport={handleExport}
							pending={exportUserRolesQuery.isPending}
						/>
						<Button variant="outline" onClick={() => setInviteOpen(true)}>
							<Mail />
							Invitar usuario
						</Button>
						<Button variant="outline" onClick={() => setBulkAssignOpen(true)}>
							<UsersRound />
							Asignar a varios
						</Button>
						<Button onClick={() => setAssignOpen(true)}>
							<UserPlus />
							Asignar rol
						</Button>
					</>
				}
			/>

			{isForbidden ? (
				<ForbiddenState description={getErrorMessage(activeError)} />
			) : !isTable ? (
				<div className="space-y-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						{viewSwitch}
						{filterControls}
					</div>
					<UserRolesCards
						rows={allQuery.data ?? []}
						groupBy={view === "users" ? "users" : "systems"}
						usersById={usersById}
						isLoading={allQuery.isPending}
						isError={allQuery.isError}
						onRetry={() => allQuery.refetch()}
						emptyText={
							controls.isFiltered
								? "No hay asignaciones con estos filtros."
								: "Aún no hay roles asignados a usuarios."
						}
						onRevoke={(userRole) => setToRevoke(userRole)}
					/>
				</div>
			) : (
				<DataTable
					columns={columns}
					data={query.data?.userRoles ?? []}
					pagination={query.data?.pagination}
					isLoading={query.isPending}
					isFetching={query.isFetching}
					isError={query.isError}
					onRetry={() => query.refetch()}
					onPageChange={controls.onPageChange}
					onLimitChange={controls.onLimitChange}
					sortBy={controls.sortBy}
					sortDir={controls.sortDir}
					onSortChange={controls.onSortChange}
					isFiltered={controls.isFiltered}
					getRowId={(userRole) => userRole.id}
					emptyTitle="Sin asignaciones"
					emptyDescription="Aún no hay roles asignados a usuarios."
					filters={
						<>
							{viewSwitch}
							{filterControls}
						</>
					}
					enableRowSelection
					renderSelectionActions={(rows, clear) => (
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setBulk({ rows, clear })}
						>
							<Trash2 />
							Revocar
						</Button>
					)}
				/>
			)}

			<AssignRoleDialog
				open={assignOpen}
				onOpenChange={(open) => {
					setAssignOpen(open);
					if (!open) setLockedSystemId(undefined);
				}}
				defaultUserId={filters.userId}
				defaultSystemId={filters.systemId}
				lockedSystemId={lockedSystemId}
			/>
			<InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
			<BulkAssignRoleDialog
				open={bulkAssignOpen}
				onOpenChange={setBulkAssignOpen}
			/>

			<ConfirmDialog
				open={bulk !== null}
				onOpenChange={(open) => !open && setBulk(null)}
				title="Revocar asignaciones"
				description={
					bulk ? (
						<span className="space-y-3">
							<span className="block">
								¿Seguro que quieres revocar {bulk.rows.length} asignación(es)?
								Los usuarios perderán el acceso que dependa de esos roles.
							</span>
							{bulk.rows.some(isAuthAdminAssignment) && (
								<span className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
									<TriangleAlert className="mt-0.5 size-4 shrink-0" />
									<span>
										La selección incluye roles <strong>admin</strong> de esta
										consola. Si te los quitas a ti mismo, o dejas la consola sin
										administradores, nadie podrá volver a gestionarla.
									</span>
								</span>
							)}
							{bulk.rows.some(
								(row) =>
									isSystemAdminAssignment(row) && !isAuthAdminAssignment(row),
							) && (
								<span className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
									<TriangleAlert className="mt-0.5 size-4 shrink-0" />
									<span>
										La selección incluye roles <strong>admin</strong> de otros
										sistemas. No se puede quitar el último administrador de un
										sistema.
									</span>
								</span>
							)}
						</span>
					) : undefined
				}
				confirmLabel="Revocar"
				destructive
				loading={deleteUserRole.isPending}
				onConfirm={confirmBulk}
			/>

			<ConfirmDialog
				open={toRevoke !== null}
				onOpenChange={(open) => !open && setToRevoke(null)}
				title="Revocar asignación"
				description={
					toRevoke ? (
						<span className="space-y-3">
							<span className="block">
								Vas a quitar el rol{" "}
								<strong>{revokeRole?.name ?? toRevoke.roleId}</strong>
								{revokeSystem && <> del sistema «{revokeSystem.name}»</>} a{" "}
								<strong>{revokeUser?.name ?? toRevoke.userId}</strong>. Perderá
								el acceso que dependa de él.
							</span>
							{revokeIsAuthAdmin && (
								<span className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
									<TriangleAlert className="mt-0.5 size-4 shrink-0" />
									<span>
										Es un rol <strong>admin</strong> de esta consola. Si te lo
										quitas a ti mismo, o dejas la consola sin administradores,
										nadie podrá volver a gestionarla.
									</span>
								</span>
							)}
							{revokeIsSystemAdmin && (
								<span className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
									<TriangleAlert className="mt-0.5 size-4 shrink-0" />
									<span>
										Es un rol <strong>admin</strong> del sistema
										{revokeSystem ? ` «${revokeSystem.name}»` : ""}. Quien lo
										pierda dejará de poder administrarlo. No se puede quitar el
										último administrador de un sistema.
									</span>
								</span>
							)}
						</span>
					) : undefined
				}
				confirmLabel="Revocar"
				destructive
				loading={deleteUserRole.isPending}
				onConfirm={confirmRevoke}
			/>
		</div>
	);
}
