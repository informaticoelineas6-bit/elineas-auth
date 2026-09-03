import { RotateCcw } from "lucide-react";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/modules/common/components/ui/empty.tsx";
import { DataTableStateRow } from "./data-table-state-row.tsx";

// Estado de error con opción de reintentar la carga.
export function DataTableError({
	columns,
	onRetry,
}: {
	columns: number;
	onRetry?: () => void;
}) {
	return (
		<DataTableStateRow columns={columns}>
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
		</DataTableStateRow>
	);
}
