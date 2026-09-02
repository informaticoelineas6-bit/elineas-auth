import {
	type RowData,
	type RowSelectionState,
	useTable,
} from "@tanstack/react-table";
import * as React from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/modules/common/components/ui/table.tsx";
import { cn } from "@/modules/common/lib/utils.ts";
import type { Pagination } from "@/modules/common/shared/types.ts";
import { DataTableEmpty } from "./data-table-empty.tsx";
import { DataTableError } from "./data-table-error.tsx";
import { DataTablePagination } from "./data-table-pagination.tsx";
import { buildSelectionColumn } from "./data-table-selection-column.tsx";
import { DataTableSkeleton } from "./data-table-skeleton.tsx";
import { DataTableToolbar } from "./data-table-toolbar.tsx";
import { type DataTableColumn, dataTableFeatures } from "./features.ts";

export type DataTableProps<TData extends RowData> = {
	columns: DataTableColumn<TData>[];
	data: TData[];
	/** Objeto `pagination` de la API (page, limit, total, totalPages). */
	pagination?: Pagination;

	// --- Estados (normalmente vienen tal cual de useQuery) ---
	/** Primera carga sin datos previos: muestra skeleton de filas. */
	isLoading?: boolean;
	/** Refetch en segundo plano: atenúa la tabla y muestra un spinner sutil. */
	isFetching?: boolean;
	isError?: boolean;
	onRetry?: () => void;

	// --- Búsqueda / paginación (spread de `controls` de useListControls) ---
	search?: string;
	onSearchChange?: (value: string) => void;
	onPageChange?: (page: number) => void;
	onLimitChange?: (limit: number) => void;
	/** Distingue "no hay datos" de "no hay resultados para este filtro". */
	isFiltered?: boolean;

	// --- Composición ---
	searchPlaceholder?: string;
	/** Slot de filtros por columna a la derecha de la búsqueda. */
	filters?: React.ReactNode;
	/** Acciones globales (p. ej. botón "Nuevo"). */
	toolbarActions?: React.ReactNode;

	// --- Selección de filas ---
	/** Añade una columna de checkboxes y habilita la selección por fila. */
	enableRowSelection?: boolean;
	/**
	 * Acciones generales que operan sobre la selección (p. ej. eliminar en lote).
	 * Se muestran en la barra de herramientas solo cuando hay filas seleccionadas.
	 * `clearSelection` permite vaciar la selección tras completar la acción.
	 */
	renderSelectionActions?: (
		selected: TData[],
		clearSelection: () => void,
	) => React.ReactNode;

	// --- Textos del estado vacío ---
	emptyTitle?: string;
	emptyDescription?: string;
	/** Id estable de fila (por defecto usa el índice). */
	getRowId?: (row: TData) => string;
	className?: string;
};

export function DataTable<TData extends RowData>({
	columns,
	data,
	pagination,
	isLoading = false,
	isFetching = false,
	isError = false,
	onRetry,
	search,
	onSearchChange,
	onPageChange,
	onLimitChange,
	isFiltered = false,
	searchPlaceholder = "Buscar…",
	filters,
	toolbarActions,
	emptyTitle = "Sin datos",
	emptyDescription = "Aún no hay registros para mostrar.",
	getRowId,
	className,
	enableRowSelection = false,
	renderSelectionActions,
}: DataTableProps<TData>) {
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

	const resolvedColumns = React.useMemo<DataTableColumn<TData>[]>(
		() =>
			enableRowSelection
				? [buildSelectionColumn<TData>(), ...columns]
				: columns,
		[columns, enableRowSelection],
	);

	// El listado, el filtrado y la paginación los resuelve el IS: la tabla solo
	// pinta la página que llega. Por eso no se registran esas features (ni hacen
	// falta `manualPagination`/`manualFiltering`/`pageCount`, que eran opciones
	// de las features de la v8 que aquí no existen).
	const table = useTable({
		features: dataTableFeatures,
		data,
		columns: resolvedColumns,
		getRowId,
		enableRowSelection,
		state: enableRowSelection ? { rowSelection } : undefined,
		onRowSelectionChange: setRowSelection,
	});

	// `getAllLeafColumns` y no `getVisibleLeafColumns`: ocultar columnas es la
	// feature `columnVisibilityFeature`, que no se registra.
	const columnCount =
		table.getAllLeafColumns().length || resolvedColumns.length;

	const selectedRows = enableRowSelection
		? table.getSelectedRowModel().rows.map((row) => row.original)
		: [];
	const selectionActions =
		selectedRows.length > 0 && renderSelectionActions
			? renderSelectionActions(selectedRows, () => setRowSelection({}))
			: null;

	return (
		<div className={cn("space-y-4", className)}>
			<DataTableToolbar
				search={search}
				onSearchChange={onSearchChange}
				searchPlaceholder={searchPlaceholder}
				filters={filters}
				toolbarActions={toolbarActions}
				selectionActions={selectionActions}
				selectedCount={selectedRows.length}
			/>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((group) => (
							<TableRow key={group.id}>
								{group.headers.map((header) => (
									<TableHead
										key={header.id}
										className={header.column.columnDef.meta?.headerClassName}
									>
										{header.isPlaceholder ? null : (
											<table.FlexRender header={header} />
										)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody
						className={cn(
							isFetching && !isLoading && "opacity-60 transition-opacity",
						)}
					>
						{isLoading ? (
							<DataTableSkeleton
								rows={pagination?.limit ?? 8}
								columns={columnCount}
							/>
						) : isError ? (
							<DataTableError columns={columnCount} onRetry={onRetry} />
						) : data.length === 0 ? (
							<DataTableEmpty
								columns={columnCount}
								isFiltered={isFiltered}
								title={emptyTitle}
								description={emptyDescription}
							/>
						) : (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getAllCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={cell.column.columnDef.meta?.className}
										>
											<table.FlexRender cell={cell} />
										</TableCell>
									))}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{pagination && !isError && (
				<DataTablePagination
					pagination={pagination}
					isFetching={isFetching}
					onPageChange={onPageChange}
					onLimitChange={onLimitChange}
				/>
			)}
		</div>
	);
}
