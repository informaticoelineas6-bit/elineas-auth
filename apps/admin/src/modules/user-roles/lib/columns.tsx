import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { DataTableRowActions } from "@/modules/common/components/data-table";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import type { Role } from "@/modules/roles/shared/types.ts";
import type { System } from "@/modules/systems/shared/types.ts";
import type { UserRole } from "../shared/types.ts";

export type ResolvedUser = { name: string; email: string };

// Columnas de la tabla de asignaciones. Las filas del IS solo traen ids
// (userId/roleId), así que la página inyecta los mapas para resolver nombre de
// usuario, rol y sistema; cuando un id no está en su mapa (fuera del límite
// cargado o sin permiso) se muestra el id como último recurso.
export function getUserRoleColumns({
	usersById,
	rolesById,
	systemsById,
	onRevoke,
}: {
	usersById: Map<string, ResolvedUser>;
	rolesById: Map<string, Role>;
	systemsById: Map<string, System>;
	onRevoke: (userRole: UserRole) => void;
}): ColumnDef<UserRole, unknown>[] {
	return [
		{
			id: "user",
			header: "Usuario",
			cell: ({ row }) => {
				const user = usersById.get(row.original.userId);
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
			cell: ({ row }) => {
				const role = rolesById.get(row.original.roleId);
				return role ? (
					role.name
				) : (
					<span className="text-muted-foreground">{row.original.roleId}</span>
				);
			},
		},
		{
			id: "system",
			header: "Sistema",
			cell: ({ row }) => {
				const role = rolesById.get(row.original.roleId);
				const system = role ? systemsById.get(role.systemId) : undefined;
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
