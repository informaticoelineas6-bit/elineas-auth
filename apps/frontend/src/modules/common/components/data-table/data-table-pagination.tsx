import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/modules/common/components/ui/select.tsx";
import { Spinner } from "@/modules/common/components/ui/spinner.tsx";
import type { Pagination } from "@/modules/common/shared/types.ts";

const LIMIT_OPTIONS = [10, 20, 50, 100];

// Pie minimalista: resumen (rango/total) + tamaño de página + navegación.
export function DataTablePagination({
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
		<div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
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
