import type { ColumnDef } from "@tanstack/react-table";
import {
	Copy,
	Eye,
	KeyRound,
	Pencil,
	Power,
	PowerOff,
	Trash2,
} from "lucide-react";
import {
	DataTableRowActions,
	type RowAction,
} from "@/modules/common/components/data-table";
import { Badge } from "@/modules/common/components/ui/badge.tsx";
import { formatDate } from "@/modules/common/lib/format.ts";
import type { Employee } from "../shared/types.ts";

// Columnas de la tabla de usuarios (empleados con su cuenta enlazada). Los
// handlers de fila se inyectan desde la página para mantener las columnas puras
// (sin estado ni data fetching). Las fechas se muestran en es-ES; el CI tal cual.
export function getEmployeeColumns({
	onView,
	onEdit,
	onManageRoles,
	onCopyEmail,
	onToggleActive,
	onDelete,
}: {
	onView: (employee: Employee) => void;
	onEdit: (employee: Employee) => void;
	// Acciones sobre la cuenta de usuario enlazada; solo aplican si existe.
	onManageRoles: (employee: Employee) => void;
	onCopyEmail: (employee: Employee) => void;
	onToggleActive: (employee: Employee) => void;
	onDelete: (employee: Employee) => void;
}): ColumnDef<Employee, unknown>[] {
	return [
		{
			id: "name",
			header: "Nombre",
			cell: ({ row }) => (
				<span className="font-medium">
					{row.original.name} {row.original.lastName}
				</span>
			),
		},
		{
			id: "email",
			header: "Email",
			cell: ({ row }) =>
				row.original.user?.email ?? (
					<span className="text-muted-foreground">—</span>
				),
		},
		{ accessorKey: "ci", header: "CI" },
		{
			accessorKey: "phoneNumber",
			header: "Teléfono",
			cell: ({ row }) =>
				row.original.phoneNumber ?? (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			accessorKey: "inDate",
			header: "Alta",
			cell: ({ row }) => formatDate(row.original.inDate),
		},
		{
			accessorKey: "outDate",
			header: "Baja",
			cell: ({ row }) => formatDate(row.original.outDate),
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
			cell: ({ row }) => {
				const employee = row.original;
				const hasAccount = Boolean(employee.userId);
				const hasEmail = Boolean(employee.user?.email);
				const actions: RowAction[] = [
					{
						label: "Ver detalle",
						icon: Eye,
						onSelect: () => onView(employee),
					},
					{
						label: "Editar",
						icon: Pencil,
						onSelect: () => onEdit(employee),
					},
					// Acciones sobre la cuenta de usuario enlazada.
					...(hasAccount
						? [
								{
									label: "Gestionar roles",
									icon: KeyRound,
									onSelect: () => onManageRoles(employee),
								} satisfies RowAction,
							]
						: []),
					...(hasEmail
						? [
								{
									label: "Copiar email",
									icon: Copy,
									onSelect: () => onCopyEmail(employee),
								} satisfies RowAction,
							]
						: []),
					{
						label: employee.active ? "Desactivar" : "Activar",
						icon: employee.active ? PowerOff : Power,
						onSelect: () => onToggleActive(employee),
					},
					{
						label: "Eliminar",
						icon: Trash2,
						destructive: true,
						onSelect: () => onDelete(employee),
					},
				];
				return <DataTableRowActions actions={actions} />;
			},
		},
	];
}
