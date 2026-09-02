import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/modules/common/components/ui/select.tsx";
import { cn } from "@/modules/common/lib/utils.ts";

// Valor sentinela para la opción "todos" (limpiar el filtro): Radix Select solo
// admite strings, así que serializamos el valor real con JSON.
const ALL_VALUE = "__all__";

export type FilterOption<T> = { label: string; value: T };

// Filtro por columna genérico (p. ej. `active` como true/false/todos). Soporta
// valores string/number/boolean; el valor `undefined` representa "sin filtro".
export function DataTableFilterSelect<T extends string | number | boolean>({
	value,
	options,
	onChange,
	placeholder = "Filtrar",
	allLabel = "Todos",
	className,
}: {
	value: T | undefined;
	options: FilterOption<T>[];
	onChange: (value: T | undefined) => void;
	placeholder?: string;
	allLabel?: string;
	className?: string;
}) {
	return (
		<Select
			value={value === undefined ? ALL_VALUE : JSON.stringify(value)}
			onValueChange={(raw) =>
				onChange(raw === ALL_VALUE ? undefined : (JSON.parse(raw) as T))
			}
		>
			{/* size "default" (h-9) para igualar la altura del input de búsqueda;
			    w-fit ajusta el ancho al contenido (la opción más larga). */}
			<SelectTrigger className={cn("w-fit", className)}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
				{options.map((option) => (
					<SelectItem
						key={String(option.value)}
						value={JSON.stringify(option.value)}
					>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
