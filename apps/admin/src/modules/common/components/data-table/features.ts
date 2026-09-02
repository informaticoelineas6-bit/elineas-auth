import {
	type ColumnDef,
	metaHelper,
	type RowData,
	rowSelectionFeature,
	tableFeatures,
} from "@tanstack/react-table";

// Metadatos por columna: permiten alinear/estilar celdas desde la propia
// definición, p. ej. `meta: { className: "text-right", headerClassName: "w-10" }`.
export type DataTableColumnMeta = {
	className?: string;
	headerClassName?: string;
};

// Funciones que registra la tabla compartida. En la v9 nada viene incluido de
// oficio: lo que no se registre aquí no entra al bundle y su API no existe en
// la instancia. Solo hace falta la selección de filas —el filtrado, el orden y
// la paginación los resuelve el IS, no la tabla— y el modelo de filas del
// núcleo, que es automático (ya no hay `getCoreRowModel`).
//
// `columnMeta` sustituye al `declare module` de la v8: el tipo de `meta` queda
// atado a estas features en vez de a toda la librería.
export const dataTableFeatures = tableFeatures({
	rowSelectionFeature,
	columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

// Tipo de columna de la tabla compartida: es el `ColumnDef` de la v9, que ahora
// lleva las features por delante del tipo de fila. Los `lib/columns.tsx` de cada
// módulo lo usan para no repetir `typeof dataTableFeatures`.
export type DataTableColumn<TData extends RowData> = ColumnDef<
	DataTableFeatures,
	TData,
	unknown
>;
