import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/modules/common/lib/utils.ts";
import type { SortDir } from "@/modules/common/shared/types.ts";

// Contenido de cabecera con botón de orden. El ciclo es sin orden → ascendente
// → descendente → sin orden (vuelve al orden por defecto del servidor).
export function DataTableSortHeader({
	children,
	label,
	active,
	dir,
	onToggle,
	className,
}: {
	children: React.ReactNode;
	/** Texto accesible de la columna. */
	label?: string;
	active: boolean;
	dir?: SortDir;
	onToggle: () => void;
	className?: string;
}) {
	const Icon = !active ? ChevronsUpDown : dir === "desc" ? ArrowDown : ArrowUp;
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={label ? `Ordenar por ${label}` : "Ordenar columna"}
			className={cn(
				"-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
				active && "text-foreground",
				className,
			)}
		>
			{children}
			<Icon
				className={cn("size-3.5", active ? "opacity-100" : "opacity-40")}
				aria-hidden
			/>
		</button>
	);
}
