import type * as React from "react";
import { TableCell, TableRow } from "@/modules/common/components/ui/table.tsx";

// Fila a todo el ancho de la tabla para alojar estados (vacío/error) centrados.
export function DataTableStateRow({
	columns,
	children,
}: {
	columns: number;
	children: React.ReactNode;
}) {
	return (
		<TableRow className="hover:bg-transparent">
			<TableCell colSpan={columns} className="h-64 p-0">
				{children}
			</TableCell>
		</TableRow>
	);
}
