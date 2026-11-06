import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Mail, Pencil, UserCog, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	DataTable,
	type DataTableColumn,
	DataTableFilterSelect,
	DataTableRowActions,
	useListControls,
} from "@/modules/common/components/data-table";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { deferOnClient } from "@/modules/common/lib/query.ts";
import { EditManagedUserDialog } from "@/modules/managed-users/components/edit-managed-user-dialog.tsx";
import { managedUserFiltersSchema } from "@/modules/managed-users/lib/filters.ts";
import {
	managedUsersQueries,
	useResendManagedUserInvite,
} from "@/modules/managed-users/queries/managed-users.ts";
import type {
	ManagedUser,
	ManagedUserFilters,
} from "@/modules/managed-users/shared/types.ts";
import { requireSystemManagerAccess } from "@/modules/permissions/lib/guard.ts";
import { ChangeUserPasswordDialog } from "@/modules/users/components/change-user-password-dialog.tsx";
import { AssignRoleDialog } from "@/modules/user-roles/components/assign-role-dialog.tsx";
import { InviteUserDialog } from "@/modules/user-roles/components/invite-user-dialog.tsx";

export const Route = createFileRoute("/_authed/system-users")({
	validateSearch: managedUserFiltersSchema,
	beforeLoad: ({ context }) => requireSystemManagerAccess(context),
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, deps }) =>
		deferOnClient(queryClient.prefetchQuery(managedUsersQueries.list(deps))),
	component: SystemUsersPage,
});

function SystemUsersPage() {
	const { managedSystems } = Route.useRouteContext();
	const { filters, controls, setFilter } = useListControls<ManagedUserFilters>();
	const query = useQuery(managedUsersQueries.list(filters));
	const resendInvite = useResendManagedUserInvite();

	const [editing, setEditing] = useState<ManagedUser | null>(null);
	const [changingPassword, setChangingPassword] = useState<ManagedUser | null>(
		null,
	);
	const [assigning, setAssigning] = useState<ManagedUser | null>(null);
	const [inviteOpen, setInviteOpen] = useState(false);

	const isForbidden = getErrorStatus(query.error) === 403;
	// Con un solo sistema administrado no hace falta elegirlo.
	const defaultSystemId =
		filters.systemId ??
		(managedSystems.length === 1 ? managedSystems[0].id : undefined);

	function sendInvite(user: ManagedUser) {
		resendInvite.mutate(user.id, {
			onSuccess: () => toast.success(`Invitación enviada a ${user.email}`),
			onError: (error) => reportError(error, getErrorMessage(error)),
		});
	}

	const columns: DataTableColumn<ManagedUser>[] = [
		{
			id: "user",
			header: "Usuario",
			cell: ({ row }) => {
				const user = row.original;
				return (
					<div className="flex flex-col">
						<span className="font-medium">
							{user.employee
								? `${user.employee.name} ${user.employee.lastName}`
								: user.name}
						</span>
						<span className="text-xs text-muted-foreground">{user.email}</span>
					</div>
				);
			},
		},
		{
			id: "roles",
			header: "Roles en tu sistema",
			cell: ({ row }) => (
				<div className="flex flex-wrap gap-1">
					{row.original.roles.map((role) => (
						<Badge key={role.id} variant="secondary" className="font-normal">
							{managedSystems.length > 1 ? `${role.system.name} · ` : ""}
							{role.name}
						</Badge>
					))}
				</div>
			),
		},
		{
			id: "state",
			header: "Estado",
			cell: ({ row }) => (
				<div className="flex flex-wrap gap-1">
					{!row.original.active && (
						<Badge variant="destructive">Desactivado</Badge>
					)}
					{!row.original.editable && (
						<Badge variant="outline" title="Tiene roles en otros sistemas: solo puedes gestionar sus roles de tu sistema">
							Cuenta compartida
						</Badge>
					)}
					{row.original.active && row.original.editable && (
						<span className="text-muted-foreground">—</span>
					)}
				</div>
			),
		},
		{
			id: "actions",
			header: "Acciones",
			meta: { className: "text-right", headerClassName: "text-right" },
			cell: ({ row }) => {
				const user = row.original;
				return (
					<DataTableRowActions
						actions={[
							{
								label: "Asignar rol",
								icon: UserCog,
								onSelect: () => setAssigning(user),
							},
							{
								label: "Editar datos",
								icon: Pencil,
								disabled: !user.editable,
								onSelect: () => setEditing(user),
							},
							{
								label: "Cambiar contraseña",
								icon: KeyRound,
								disabled: !user.editable,
								onSelect: () => setChangingPassword(user),
							},
							{
								label: "Reenviar invitación",
								icon: Mail,
								onSelect: () => sendInvite(user),
							},
						]}
					/>
				);
			},
		},
	];

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Usuarios del sistema" }]} />
			<PageHeader
				title="Usuarios del sistema"
				description="Personas con algún rol en los sistemas que administras. Gestiona sus roles, invítalas y edita sus datos o contraseña (salvo cuentas compartidas con otros sistemas)."
				actions={
					<Button onClick={() => setInviteOpen(true)}>
						<UserPlus />
						Invitar usuario
					</Button>
				}
			/>

			{isForbidden ? (
				<ForbiddenState description={getErrorMessage(query.error)} />
			) : (
				<DataTable
					columns={columns}
					data={query.data?.users ?? []}
					pagination={query.data?.pagination}
					isLoading={query.isPending}
					isFetching={query.isFetching}
					isError={query.isError}
					onRetry={() => query.refetch()}
					onPageChange={controls.onPageChange}
					onLimitChange={controls.onLimitChange}
					search={controls.search}
					onSearchChange={controls.onSearchChange}
					searchPlaceholder="Buscar por nombre o correo…"
					isFiltered={controls.isFiltered}
					getRowId={(user) => user.id}
					emptyTitle="Sin usuarios"
					emptyDescription="Aún nadie tiene un rol en tus sistemas. Invita a alguien y asígnale uno."
					filters={
						managedSystems.length > 1 ? (
							<DataTableFilterSelect
								value={filters.systemId}
								onChange={(value) => setFilter("systemId", value)}
								placeholder="Sistema"
								allLabel="Todos mis sistemas"
								options={managedSystems.map((system) => ({
									label: system.name,
									value: system.id,
								}))}
							/>
						) : undefined
					}
				/>
			)}

			<EditManagedUserDialog
				user={editing}
				onOpenChange={(open) => !open && setEditing(null)}
			/>
			{changingPassword && (
				<ChangeUserPasswordDialog
					open
					managed
					onOpenChange={(open) => !open && setChangingPassword(null)}
					userId={changingPassword.id}
					userLabel={changingPassword.name}
				/>
			)}
			<AssignRoleDialog
				open={assigning !== null}
				onOpenChange={(open) => !open && setAssigning(null)}
				lockedUser={
					assigning
						? {
								userId: assigning.id,
								label: `${assigning.name} (${assigning.email})`,
							}
						: undefined
				}
				defaultSystemId={defaultSystemId}
			/>
			<InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
		</div>
	);
}
