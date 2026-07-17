import type { RowData } from "@tanstack/react-table";

// Augmentación global de ColumnMeta: permite alinear/estilar celdas desde la
// propia definición de columna, p. ej.:
//   { ..., meta: { className: "text-right", headerClassName: "w-10" } }
declare module "@tanstack/react-table" {
	interface ColumnMeta<TData extends RowData, TValue> {
		className?: string;
		headerClassName?: string;
	}
}
