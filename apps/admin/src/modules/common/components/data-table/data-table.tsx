import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type RowSelectionState,
	useReactTable,
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
// Augmentación de ColumnMeta (className / headerClassName por columna).
import "./column-meta.ts";
import { DataTableEmpty } from "./data-table-empty.tsx";
import { DataTableError } from "./data-table-error.tsx";
import { DataTablePagination } from "./data-table-pagination.tsx";
import { buildSelectionColumn } from "./data-table-selection-column.tsx";
import { DataTableSkeleton } from "./data-table-skeleton.tsx";
import { DataTableToolbar } from "./data-table-toolbar.tsx";

export type DataTableProps<TData> = {
	columns: ColumnDef<TData, unknown>[];
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

export function DataTable<TData>({
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

	const resolvedColumns = React.useMemo<ColumnDef<TData, unknown>[]>(
		() =>
			enableRowSelection
				? [buildSelectionColumn<TData>(), ...columns]
				: columns,
		[columns, enableRowSelection],
	);

	const table = useReactTable({
		data,
		columns: resolvedColumns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		manualFiltering: true,
		pageCount: pagination?.totalPages ?? -1,
		getRowId,
		enableRowSelection,
		state: enableRowSelection ? { rowSelection } : undefined,
		onRowSelectionChange: setRowSelection,
	});

	const columnCount =
		table.getVisibleLeafColumns().length || resolvedColumns.length;

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
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
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
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={cell.column.columnDef.meta?.className}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
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
