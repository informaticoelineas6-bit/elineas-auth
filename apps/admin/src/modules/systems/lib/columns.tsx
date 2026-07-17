import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { DataTableRowActions } from "@/modules/common/components/data-table";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import type { System } from "../shared/types.ts";

// Columnas de la tabla de sistemas. Los handlers de fila se inyectan desde la
// página para mantener las columnas puras (sin estado ni data fetching) y así
// reutilizables/testeables. `canDelete` deshabilita el borrado por regla de
// negocio (no dejar la tabla sin sistemas).
export function getSystemColumns({
	canDelete,
	onEdit,
	onDelete,
}: {
	canDelete: boolean;
	onEdit: (system: System) => void;
	onDelete: (system: System) => void;
}): ColumnDef<System, unknown>[] {
	return [
		{ accessorKey: "name", header: "Nombre" },
		{
			accessorKey: "slug",
			header: "Slug",
			cell: ({ row }) => (
				<span className="text-muted-foreground">{row.original.slug}</span>
			),
		},
		{
			accessorKey: "active",
			header: "Estado",
			cell: ({ row }) => (
				<Badge variant={row.original.active ? "default" : "secondary"}>
					{row.original.active ? "Activo" : "Inactivo"}
				</Badge>
			),
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
							disabled: !canDelete,
							onSelect: () => onDelete(row.original),
						},
					]}
				/>
			),
		},
	];
}
