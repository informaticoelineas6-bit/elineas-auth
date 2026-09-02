import { SearchIcon } from "lucide-react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/modules/common/components/ui/empty.tsx";
import { DataTableStateRow } from "./data-table-state-row.tsx";

// Estado vacío. Distingue "no hay datos" de "no hay resultados para el filtro".
export function DataTableEmpty({
	columns,
	isFiltered,
	title,
	description,
}: {
	columns: number;
	isFiltered: boolean;
	title: string;
	description: string;
}) {
	return (
		<DataTableStateRow columns={columns}>
			<Empty className="border-0">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon />
					</EmptyMedia>
					<EmptyTitle>{isFiltered ? "Sin resultados" : title}</EmptyTitle>
					<EmptyDescription>
						{isFiltered
							? "Ningún registro coincide con la búsqueda o los filtros aplicados."
							: description}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</DataTableStateRow>
	);
}
