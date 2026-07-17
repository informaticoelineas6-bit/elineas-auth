import { SearchIcon } from "lucide-react";
import type * as React from "react";
import { Input } from "@/modules/common/components/ui/input.tsx";

// Barra superior: búsqueda + filtros + acciones. Con filas seleccionadas, la
// zona derecha muestra las acciones generales sobre la selección.
export function DataTableToolbar({
	search,
	onSearchChange,
	searchPlaceholder,
	filters,
	toolbarActions,
	selectionActions,
	selectedCount,
}: {
	search?: string;
	onSearchChange?: (value: string) => void;
	searchPlaceholder: string;
	filters?: React.ReactNode;
	toolbarActions?: React.ReactNode;
	selectionActions?: React.ReactNode;
	selectedCount: number;
}) {
	const showSearch = typeof onSearchChange === "function";
	if (!showSearch && !filters && !toolbarActions && !selectionActions) {
		return null;
	}

	return (
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
						{selectedCount} seleccionada(s)
					</span>
					{selectionActions}
				</div>
			) : (
				toolbarActions && (
					<div className="flex items-center gap-2">{toolbarActions}</div>
				)
			)}
		</div>
	);
}
