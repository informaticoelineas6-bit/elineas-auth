import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { TableCell, TableRow } from "@/modules/common/components/ui/table.tsx";

// Filas de placeholder durante la primera carga (sin datos previos).
export function DataTableSkeleton({
	rows,
	columns,
}: {
	rows: number;
	columns: number;
}) {
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
