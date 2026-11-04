import { Trash2 } from "lucide-react";
import type { DataTableColumn } from "@/modules/common/components/data-table";
import { DataTableRowActions } from "@/modules/common/components/data-table";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import type { Role } from "@/modules/roles/shared/types.ts";
import type { System } from "@/modules/systems/shared/types.ts";
import type { UserRoleDetail } from "../shared/types.ts";

export type ResolvedUser = { name: string; email: string };

// Columnas de la tabla de asignaciones. Cada fila ya trae usuario, rol y sistema
// resueltos por el IS. Los mapas inyectados solo mejoran el nombre (el del
// empleado enlazado, más completo que el de la cuenta) y no son necesarios para
// que algo se muestre; el id queda solo como último recurso.
export function getUserRoleColumns({
	usersById,
	rolesById,
	systemsById,
	onRevoke,
}: {
	usersById: Map<string, ResolvedUser>;
	rolesById: Map<string, Role>;
	systemsById: Map<string, System>;
	onRevoke: (userRole: UserRoleDetail) => void;
}): DataTableColumn<UserRoleDetail>[] {
	return [
		{
			id: "user",
			header: "Usuario",
			meta: { sortKey: "user" },
			cell: ({ row }) => {
				const user = usersById.get(row.original.userId) ?? row.original.user;
				if (!user) {
					return (
						<span className="text-muted-foreground">{row.original.userId}</span>
					);
				}
				return (
					<div className="flex flex-col">
						<span className="font-medium">{user.name}</span>
						<span className="text-xs text-muted-foreground">{user.email}</span>
					</div>
				);
			},
		},
		{
			id: "role",
			header: "Rol",
			meta: { sortKey: "role" },
			cell: ({ row }) => {
				const name =
					rolesById.get(row.original.roleId)?.name ?? row.original.role?.name;
				return name ? (
					name
				) : (
					<span className="text-muted-foreground">{row.original.roleId}</span>
				);
			},
		},
		{
			id: "system",
			header: "Sistema",
			meta: { sortKey: "system" },
			cell: ({ row }) => {
				const role = rolesById.get(row.original.roleId);
				const system =
					(role ? systemsById.get(role.systemId) : undefined) ??
					row.original.system;
				if (!system) return <span className="text-muted-foreground">—</span>;
				return (
					<span className="flex items-center gap-2">
						{system.name}
						<Badge variant="outline" className="font-mono text-xs">
							{system.slug}
						</Badge>
					</span>
				);
			},
		},
		{
			accessorKey: "createdAt",
			header: "Asignado",
			meta: { sortKey: "createdAt" },
			cell: ({ row }) => formatDate(row.original.createdAt),
		},
		{
			id: "actions",
			header: "Acciones",
			meta: { className: "text-right", headerClassName: "text-right" },
			cell: ({ row }) => (
				<DataTableRowActions
					actions={[
						{
							label: "Revocar",
							icon: Trash2,
							destructive: true,
							onSelect: () => onRevoke(row.original),
						},
					]}
				/>
			),
		},
	];
}
