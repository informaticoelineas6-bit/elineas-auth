import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/modules/common/components/ui/dropdown-menu.tsx";
import { reportError } from "@/modules/common/lib/errors.ts";
import {
	type ExportFormat,
	exportEmployees,
} from "@/modules/employees/lib/import-export.ts";
import { useExportEmployees } from "@/modules/employees/queries/employees.ts";
import type { EmployeeFilters } from "@/modules/employees/shared/types.ts";

const FORMATS: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
	{ format: "csv", label: "Exportar CSV", icon: FileText },
	{ format: "json", label: "Exportar JSON", icon: FileJson },
	{ format: "xlsx", label: "Exportar Excel", icon: FileSpreadsheet },
];

// Botón "Exportar" del listado de usuarios: trae TODAS las filas que cumplan
// los filtros activos (no solo la página visible, ver listAllEmployeesFn) y
// dispara la descarga en el formato elegido.
export function ExportMenu({ filters }: { filters: EmployeeFilters }) {
	const exportEmployeesQuery = useExportEmployees();

	function handleExport(format: ExportFormat) {
		const { page: _page, limit: _limit, ...rest } = filters;
		exportEmployeesQuery.mutate(rest, {
			onSuccess: async (employees) => {
				if (employees.length === 0) {
					toast.info("No hay usuarios que exportar con estos filtros");
					return;
				}
				try {
					// async: el formato Excel carga `xlsx` bajo demanda (import dinámico).
					await exportEmployees(employees, format);
					toast.success(`${employees.length} usuario(s) exportado(s)`);
				} catch (error) {
					reportError(error, "No se pudo generar el archivo.");
				}
			},
			onError: (error) => reportError(error, "No se pudo exportar el listado."),
		});
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" disabled={exportEmployeesQuery.isPending}>
					<Download />
					Exportar
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{FORMATS.map(({ format, label, icon: Icon }) => (
					<DropdownMenuItem key={format} onSelect={() => handleExport(format)}>
						<Icon />
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
