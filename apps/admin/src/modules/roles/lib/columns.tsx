import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { DataTableRowActions } from "@/modules/common/components/data-table";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import type { System } from "@/modules/systems/shared/types.ts";
import type { Role } from "../shared/types.ts";

// Columnas de la tabla de roles. Los handlers de fila se inyectan desde la
// página para mantener las columnas puras. `systemsById` resuelve el nombre y
// el slug del sistema al que pertenece cada rol (los roles solo traen systemId);
// si el sistema no está en el mapa (fuera del límite cargado o sin permiso) se
// muestra el id como último recurso.
export function getRoleColumns({
	systemsById,
	onEdit,
	onDelete,
}: {
	systemsById: Map<string, System>;
	onEdit: (role: Role) => void;
	onDelete: (role: Role) => void;
}): ColumnDef<Role, unknown>[] {
	return [
		{ accessorKey: "name", header: "Nombre" },
		{
			id: "system",
			header: "Sistema",
			cell: ({ row }) => {
				const system = systemsById.get(row.original.systemId);
				if (!system) {
					return (
						<span className="text-muted-foreground">
							{row.original.systemId}
						</span>
					);
				}
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
			accessorKey: "description",
			header: "Descripción",
			cell: ({ row }) =>
				row.original.description ? (
					<span className="line-clamp-1 max-w-xs text-muted-foreground">
						{row.original.description}
					</span>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			accessorKey: "createdAt",
			header: "Creado",
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
							label: "Editar",
							icon: Pencil,
							onSelect: () => onEdit(row.original),
						},
						{
							label: "Eliminar",
							icon: Trash2,
							destructive: true,
							onSelect: () => onDelete(row.original),
						},
					]}
				/>
			),
		},
	];
}
