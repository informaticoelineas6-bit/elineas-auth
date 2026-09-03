import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/modules/common/components/ui/dropdown-menu.tsx";

export type RowAction = {
	label: string;
	icon?: LucideIcon;
	onSelect: () => void;
	/** Estiliza la acción como destructiva (rojo) y la separa del resto. */
	destructive?: boolean;
	disabled?: boolean;
};

// Menú de acciones por fila (ver, editar, eliminar…). Pensado para usarse como
// `cell` de la columna de acciones de un DataTable.
export function DataTableRowActions({
	actions,
	label = "Acciones",
}: {
	actions: RowAction[];
	label?: string;
}) {
	const safe = actions.filter(Boolean);
	const destructive = safe.filter((action) => action.destructive);
	const regular = safe.filter((action) => !action.destructive);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={label}>
					<MoreHorizontal />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40">
				<DropdownMenuLabel>{label}</DropdownMenuLabel>
				{regular.map((action) => (
					<ActionItem key={action.label} action={action} />
				))}
				{destructive.length > 0 && regular.length > 0 && (
					<DropdownMenuSeparator />
				)}
				{destructive.map((action) => (
					<ActionItem key={action.label} action={action} />
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ActionItem({ action }: { action: RowAction }) {
	const Icon = action.icon;
	return (
		<DropdownMenuItem
			variant={action.destructive ? "destructive" : "default"}
			disabled={action.disabled}
			onSelect={action.onSelect}
		>
			{Icon && <Icon />}
			{action.label}
		</DropdownMenuItem>
	);
}
