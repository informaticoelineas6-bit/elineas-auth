import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Combobox } from "@/modules/common/components/partials/combobox.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/modules/common/components/ui/select.tsx";
import { departmentsQueries } from "../queries/departments.ts";
import type { EmployeeDepartmentInput } from "../shared/types.ts";

// `isHead` sin definir = "automático": el servidor lo marca jefe solo si la
// persona es admin (y conserva el valor previo si ya era miembro).
const AUTO = "auto";

function headToValue(isHead: boolean | undefined) {
	if (isHead === undefined) return AUTO;
	return isHead ? "head" : "member";
}

function valueToHead(value: string): boolean | undefined {
	if (value === AUTO) return undefined;
	return value === "head";
}

// Selector múltiple de departamentos de una persona, con el rol (jefe o
// miembro) en cada uno. Controlado: `value` es el conjunto completo que se
// enviará como `departments` (reemplaza al actual).
export function EmployeeDepartmentsPicker({
	value,
	onChange,
	knownNames = {},
}: {
	value: EmployeeDepartmentInput[];
	onChange: (value: EmployeeDepartmentInput[]) => void;
	// Nombres ya conocidos (de la ficha) para departamentos que el listado no
	// devuelva (p. ej. más allá de la primera página).
	knownNames?: Record<string, string>;
}) {
	const query = useQuery(departmentsQueries.list({ limit: 100 }));
	const all = query.data?.departments ?? [];
	const nameOf = (id: string) =>
		all.find((d) => d.id === id)?.name ?? knownNames[id] ?? id;

	const chosen = new Set(value.map((v) => v.departmentId));
	const options = all
		.filter((d) => !chosen.has(d.id) && d.active)
		.map((d) => ({ value: d.id, label: d.name }));

	return (
		<div className="space-y-3">
			{value.length === 0 ? (
				<p className="text-sm text-muted-foreground">Sin departamentos.</p>
			) : (
				<ul className="space-y-2">
					{value.map((item) => (
						<li
							key={item.departmentId}
							className="flex items-center gap-2 rounded-md border p-2"
						>
							<span className="min-w-0 flex-1 truncate text-sm">
								{nameOf(item.departmentId)}
							</span>
							<Select
								value={headToValue(item.isHead)}
								onValueChange={(next) =>
									onChange(
										value.map((v) =>
											v.departmentId === item.departmentId
												? { ...v, isHead: valueToHead(next) }
												: v,
										),
									)
								}
							>
								<SelectTrigger
									className="w-44"
									aria-label="Rol en el departamento"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={AUTO}>
										Automático (jefe si es admin)
									</SelectItem>
									<SelectItem value="head">Jefe</SelectItem>
									<SelectItem value="member">Miembro</SelectItem>
								</SelectContent>
							</Select>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label="Quitar departamento"
								onClick={() =>
									onChange(
										value.filter((v) => v.departmentId !== item.departmentId),
									)
								}
							>
								<X />
							</Button>
						</li>
					))}
				</ul>
			)}
			<Combobox
				value={undefined}
				onChange={(id) => {
					if (id) onChange([...value, { departmentId: id }]);
				}}
				options={options}
				placeholder="Agregar departamento…"
				searchPlaceholder="Buscar departamento…"
				emptyText="No hay más departamentos"
				loading={query.isPending}
			/>
		</div>
	);
}
