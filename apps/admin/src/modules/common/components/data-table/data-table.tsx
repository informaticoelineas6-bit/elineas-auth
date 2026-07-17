import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type RowData,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, RotateCcw, SearchIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/modules/common/components/ui/empty.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/modules/common/components/ui/select.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { Spinner } from "@/modules/common/components/ui/spinner.tsx";
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

// Permite alinear/estilar celdas desde la propia definición de columna:
//   { ..., meta: { className: "text-right", headerClassName: "w-10" } }
declare module "@tanstack/react-table" {
	interface ColumnMeta<TData extends RowData, TValue> {
		className?: string;
		headerClassName?: string;
	}
}

const LIMIT_OPTIONS = [10, 20, 50, 100];

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

	// Columna de checkboxes (cabecera = seleccionar toda la página) que se
	// antepone a las columnas del recurso cuando la selección está habilitada.
	const resolvedColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
		if (!enableRowSelection) return columns;
		const selectColumn: ColumnDef<TData, unknown> = {
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
		return [selectColumn, ...columns];
	}, [columns, enableRowSelection]);

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
	const showSearch = typeof onSearchChange === "function";

	const selectedRows = enableRowSelection
		? table.getSelectedRowModel().rows.map((row) => row.original)
		: [];
	const hasSelection = selectedRows.length > 0;
	const selectionActions =
		hasSelection && renderSelectionActions
			? renderSelectionActions(selectedRows, () => setRowSelection({}))
			: null;

	return (
		<div className={cn("space-y-4", className)}>
			{/* Toolbar: búsqueda + filtros + acciones. Con filas seleccionadas, la
			    zona de acciones muestra las acciones generales de la selección. */}
			{(showSearch || filters || toolbarActions || selectionActions) && (
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
						{showSearch && (
							<div className="relative w-full sm:max-w-xs">
								<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									type="search"
									value={search ?? ""}
									onChange={(e) => onSearchChange?.(e.target.value)}
									placeholder={searchPlaceholder}
									className="pl-8"
								/>
							</div>
						)}
						{filters}
					</div>
					{selectionActions ? (
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">
								{selectedRows.length} seleccionada(s)
							</span>
							{selectionActions}
						</div>
					) : (
						toolbarActions && (
							<div className="flex items-center gap-2">{toolbarActions}</div>
						)
					)}
				</div>
			)}

			{/* Tabla */}
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
							<SkeletonRows
								rows={pagination?.limit ?? 8}
								columns={columnCount}
							/>
						) : isError ? (
							<StateRow columns={columnCount}>
								<Empty className="border-0">
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<RotateCcw />
										</EmptyMedia>
										<EmptyTitle>No se pudo cargar</EmptyTitle>
										<EmptyDescription>
											Ocurrió un error al obtener los datos.
										</EmptyDescription>
									</EmptyHeader>
									{onRetry && (
										<Button variant="outline" size="sm" onClick={onRetry}>
											<RotateCcw />
											Reintentar
										</Button>
									)}
								</Empty>
							</StateRow>
						) : data.length === 0 ? (
							<StateRow columns={columnCount}>
								<Empty className="border-0">
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<SearchIcon />
										</EmptyMedia>
										<EmptyTitle>
											{isFiltered ? "Sin resultados" : emptyTitle}
										</EmptyTitle>
										<EmptyDescription>
											{isFiltered
												? "Ningún registro coincide con la búsqueda o los filtros aplicados."
												: emptyDescription}
										</EmptyDescription>
									</EmptyHeader>
								</Empty>
							</StateRow>
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

			{/* Pie: resumen + tamaño de página + navegación */}
			{pagination && !isError && (
				<DataTableFooter
					pagination={pagination}
					isFetching={isFetching}
					onPageChange={onPageChange}
					onLimitChange={onLimitChange}
				/>
			)}
		</div>
	);
}

function DataTableFooter({
	pagination,
	isFetching,
	onPageChange,
	onLimitChange,
}: {
	pagination: Pagination;
	isFetching?: boolean;
	onPageChange?: (page: number) => void;
	onLimitChange?: (limit: number) => void;
}) {
	const { page, limit, total, totalPages } = pagination;
	const from = total === 0 ? 0 : (page - 1) * limit + 1;
	const to = Math.min(page * limit, total);
	const canPrev = page > 1;
	const canNext = page < totalPages;

	return (
		<div className="flex items-center justify-between gap-4 px-1 text-sm text-muted-foreground">
			<div className="flex items-center gap-2">
				{isFetching && <Spinner className="size-3.5" />}
				<span className="tabular-nums">
					{total === 0 ? "Sin resultados" : `${from}–${to} de ${total}`}
				</span>
			</div>

			<div className="flex items-center gap-3">
				{onLimitChange && (
					<Select
						value={String(limit)}
						onValueChange={(value) => onLimitChange(Number(value))}
					>
						<SelectTrigger
							size="sm"
							className="h-8 gap-1 border-none px-2 shadow-none hover:bg-accent"
						>
							<SelectValue />
							<span className="text-muted-foreground">/ pág.</span>
						</SelectTrigger>
						<SelectContent>
							{LIMIT_OPTIONS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				<div className="flex items-center gap-1">
					<span className="tabular-nums">
						{totalPages === 0 ? 0 : page} / {totalPages}
					</span>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Página anterior"
						disabled={!canPrev}
						onClick={() => onPageChange?.(page - 1)}
					>
						<ChevronLeft />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Página siguiente"
						disabled={!canNext}
						onClick={() => onPageChange?.(page + 1)}
					>
						<ChevronRight />
					</Button>
				</div>
			</div>
		</div>
	);
}

function StateRow({
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

function SkeletonRows({ rows, columns }: { rows: number; columns: number }) {
	return (
		<>
			{Array.from({ length: rows }).map((_, rowIndex) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: filas de placeholder sin id.
				<TableRow key={rowIndex} className="hover:bg-transparent">
					{Array.from({ length: columns }).map((__, cellIndex) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: celdas de placeholder sin id.
						<TableCell key={cellIndex}>
							<Skeleton className="h-4 w-full" />
						</TableCell>
					))}
				</TableRow>
			))}
		</>
	);
}
