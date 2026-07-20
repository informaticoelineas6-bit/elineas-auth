import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { DataTableRowActions } from "@/modules/common/components/data-table";
import { CopyButton } from "@/modules/common/components/partials/copy-button.tsx";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import type { System } from "../shared/types.ts";

// Columnas de la tabla de sistemas. Los handlers de fila se inyectan desde la
// página para mantener las columnas puras (sin estado ni data fetching) y así
// reutilizables/testeables. `canDelete` deshabilita el borrado por regla de
// negocio (no dejar la tabla sin sistemas).
export function getSystemColumns({
	canDelete,
	onView,
	onEdit,
	onDelete,
}: {
	canDelete: boolean;
	onView: (system: System) => void;
	onEdit: (system: System) => void;
	onDelete: (system: System) => void;
}): ColumnDef<System, unknown>[] {
	return [
		{ accessorKey: "name", header: "Nombre" },
		{
			accessorKey: "slug",
			header: "Slug",
			cell: ({ row }) => (
				<div className="flex items-center gap-1">
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
						{row.original.slug}
					</code>
					<CopyButton
						value={row.original.slug}
						label={`Copiar slug "${row.original.slug}"`}
					/>
				</div>
			),
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
			accessorKey: "active",
			header: "Estado",
			cell: ({ row }) => (
				<Badge variant={row.original.active ? "default" : "secondary"}>
					{row.original.active ? "Activo" : "Inactivo"}
				</Badge>
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
							label: "Ver detalle",
							icon: Eye,
							onSelect: () => onView(row.original),
						},
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
