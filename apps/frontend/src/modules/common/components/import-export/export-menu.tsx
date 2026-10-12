import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/modules/common/components/ui/dropdown-menu.tsx";
import type { ExportFormat } from "@/modules/common/lib/tabular.ts";

const FORMATS: {
	format: ExportFormat;
	label: string;
	icon: typeof FileText;
}[] = [
	{ format: "csv", label: "Exportar CSV", icon: FileText },
	{ format: "json", label: "Exportar JSON", icon: FileJson },
	{ format: "xlsx", label: "Exportar Excel", icon: FileSpreadsheet },
];

// Botón "Exportar" genérico de un listado: ofrece los tres formatos y delega en
// `onExport` (que trae los datos, genera el archivo y avisa del resultado).
export function ExportMenu({
	onExport,
	pending,
}: {
	onExport: (format: ExportFormat) => void;
	pending: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" disabled={pending}>
					<Download />
					Exportar
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{FORMATS.map(({ format, label, icon: Icon }) => (
					<DropdownMenuItem key={format} onSelect={() => onExport(format)}>
						<Icon />
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
