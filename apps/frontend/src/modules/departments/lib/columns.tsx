import { Eye, Pencil, Trash2 } from "lucide-react";
import type { DataTableColumn } from "@/modules/common/components/data-table";
import { DataTableRowActions } from "@/modules/common/components/data-table";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import type { DepartmentListItem } from "../shared/types.ts";

// Columnas de la tabla de departamentos; los handlers se inyectan desde la
// página para mantenerlas puras. Editar/eliminar se deshabilitan sin permiso.
export function getDepartmentColumns({
	canWrite,
	canDelete,
	onView,
	onEdit,
	onDelete,
}: {
	canWrite: boolean;
	canDelete: boolean;
	onView: (department: DepartmentListItem) => void;
	onEdit: (department: DepartmentListItem) => void;
	onDelete: (department: DepartmentListItem) => void;
}): DataTableColumn<DepartmentListItem>[] {
	return [
		{ accessorKey: "name", header: "Nombre", meta: { sortKey: "name" } },
		{
			accessorKey: "description",
			header: "Descripción",
			meta: { sortKey: "description" },
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
			accessorKey: "memberCount",
			header: "Miembros",
			meta: { sortKey: "members" },
		},
		{
			accessorKey: "active",
			header: "Estado",
			meta: { sortKey: "active" },
			cell: ({ row }) => (
				<Badge variant={row.original.active ? "default" : "secondary"}>
					{row.original.active ? "Activo" : "Inactivo"}
				</Badge>
			),
		},
		{
			accessorKey: "createdAt",
			header: "Creado",
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
							label: "Ver detalle",
							icon: Eye,
							onSelect: () => onView(row.original),
						},
						{
							label: "Editar",
							icon: Pencil,
							disabled: !canWrite,
							onSelect: () => onEdit(row.original),
						},
						{
							label: "Eliminar",
							icon: Trash2,
							destructive: true,
							disabled: !canDelete,
							onSelect: () => onDelete(row.original),
						},
					]}
				/>
			),
		},
	];
}
