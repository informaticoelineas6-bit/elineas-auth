import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlert, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	DataTable,
	useListControls,
} from "@/modules/common/components/data-table";
import { Combobox } from "@/modules/common/components/partials/combobox.tsx";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { employeesQueries } from "@/modules/employees/queries/employees.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import type { Role } from "@/modules/roles/shared/types.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import type { System } from "@/modules/systems/shared/types.ts";
import { AssignRoleDialog } from "@/modules/user-roles/components/assign-role-dialog.tsx";
import {
	getUserRoleColumns,
	type ResolvedUser,
} from "@/modules/user-roles/lib/columns.tsx";
import { userRoleFiltersSchema } from "@/modules/user-roles/lib/validation.ts";
import {
	useDeleteUserRole,
	userRolesQueries,
} from "@/modules/user-roles/queries/user-roles.ts";
import type {
	UserRole,
	UserRoleFilters,
} from "@/modules/user-roles/shared/types.ts";

// Nombre del rol que concede acceso a la consola (coincide con ADMIN_ROLE_NAME
// del IS, ver modules/admin/actions/admin.ts).
const ADMIN_ROLE_NAME = "admin";

export const Route = createFileRoute("/_authed/user-roles")({
	validateSearch: userRoleFiltersSchema,
	component: UserRolesPage,
});

function UserRolesPage() {
	// Roles del usuario actual en el sistema de la consola (auth): de aquí se
	// deriva el id del sistema auth para avisar al revocar un admin de esa consola.
	const { roles: myRoles } = Route.useRouteContext();
	const authSystemId = myRoles[0]?.system.id;

	const { filters, controls, setFilter } = useListControls<UserRoleFilters>();
	const query = useQuery(userRolesQueries.list(filters));
	// Fuentes para resolver ids y alimentar los filtros. Compartidas por query
	// cache (misma key en toda la app); solo se piden una vez.
	const employeesQuery = useQuery(employeesQueries.list({ limit: 100 }));
	const rolesQuery = useQuery(rolesQueries.list({ limit: 100 }));
	const systemsQuery = useQuery(systemsQueries.list({ limit: 100 }));
	const deleteUserRole = useDeleteUserRole();

	const [assignOpen, setAssignOpen] = useState(false);
	const [toRevoke, setToRevoke] = useState<UserRole | null>(null);

	const isForbidden = getErrorStatus(query.error) === 403;

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

	const userOptions = (employeesQuery.data?.employees ?? [])
		.filter((employee) => employee.userId && employee.user)
		.map((employee) => ({
			value: employee.userId as string,
			label: `${employee.name} ${employee.lastName}`,
			description: employee.user?.email,
		}));
	const roleOptions = (rolesQuery.data?.roles ?? []).map((role) => {
		const system = systemsById.get(role.systemId);
		return {
			value: role.id,
			label: role.name,
			description: system?.name,
		};
	});

	// ¿La asignación es el rol admin del sistema de la consola? Revocarlo puede
	// dejar sin acceso a la consola (a uno mismo o a la organización).
	function isAuthAdminAssignment(userRole: UserRole): boolean {
		const role = rolesById.get(userRole.roleId);
		return Boolean(
			role &&
				authSystemId &&
				role.systemId === authSystemId &&
				role.name.toLowerCase() === ADMIN_ROLE_NAME,
		);
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

	const columns = getUserRoleColumns({
		usersById,
		rolesById,
		systemsById,
		onRevoke: (userRole) => setToRevoke(userRole),
	});

	// Datos resueltos de la asignación en revocación, para el texto de confirmación.
	const revokeUser = toRevoke ? usersById.get(toRevoke.userId) : undefined;
	const revokeRole = toRevoke ? rolesById.get(toRevoke.roleId) : undefined;
	const revokeSystem = revokeRole
		? systemsById.get(revokeRole.systemId)
		: undefined;
	const revokeIsAuthAdmin = toRevoke ? isAuthAdminAssignment(toRevoke) : false;

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Asignaciones" }]} />
			<PageHeader
				title="Asignaciones"
				description="Asigna y revoca roles a los usuarios. Sin al menos un rol, un usuario no puede iniciar sesión en ningún sistema."
				actions={
					<Button onClick={() => setAssignOpen(true)}>
						<UserPlus />
						Asignar rol
					</Button>
				}
			/>

			{isForbidden ? (
				<ForbiddenState description="No tienes permisos para ver las asignaciones de rol." />
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
					isFiltered={controls.isFiltered}
					getRowId={(userRole) => userRole.id}
					emptyTitle="Sin asignaciones"
					emptyDescription="Aún no hay roles asignados a usuarios."
					filters={
						<>
							<Combobox
								className="w-56"
								value={filters.userId}
								onChange={(value) => setFilter("userId", value)}
								options={userOptions}
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
						</>
					}
				/>
			)}

			<AssignRoleDialog open={assignOpen} onOpenChange={setAssignOpen} />

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
