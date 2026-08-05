import type { RowData } from "@tanstack/react-table";
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";
import type { DataTableColumn } from "./features.ts";

// Columna de checkboxes que se antepone a las columnas del recurso cuando la
// selección está habilitada. La cabecera selecciona/deselecciona toda la página
// visible (con estado indeterminado si la selección es parcial).
//
// Se usan las variantes `…AllRows…` y no `…AllPageRows…`: estas últimas leen el
// modelo de filas paginado, que solo existe si se registra la paginación de la
// tabla, y aquí pagina el IS —las filas cargadas SON la página—.
export function buildSelectionColumn<
	TData extends RowData,
>(): DataTableColumn<TData> {
	return {
		id: "__select__",
		meta: { headerClassName: "w-10", className: "w-10" },
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllRowsSelected() ||
					// En la v9 `getIsSomeRowsSelected()` significa "al menos una",
					// incluida la selección completa: el indeterminado tiene que
					// descartar ese caso a mano.
					(table.getIsSomeRowsSelected() &&
						!table.getIsAllRowsSelected() &&
						"indeterminate")
				}
				onCheckedChange={(value) => table.toggleAllRowsSelected(Boolean(value))}
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
