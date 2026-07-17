import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";

// Columna de checkboxes que se antepone a las columnas del recurso cuando la
// selección está habilitada. La cabecera selecciona/deselecciona toda la página
// visible (con estado indeterminado si la selección es parcial).
export function buildSelectionColumn<TData>(): ColumnDef<TData, unknown> {
	return {
		id: "__select__",
		meta: { headerClassName: "w-10", className: "w-10" },
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && "indeterminate")
				}
				onCheckedChange={(value) =>
					table.toggleAllPageRowsSelected(Boolean(value))
				}
				aria-label="Seleccionar todo"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				disabled={!row.getCanSelect()}
				onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
				aria-label="Seleccionar fila"
			/>
		),
	};
}
