import { cn } from "@/modules/common/lib/utils.ts";

// Encabezado de página reutilizable: título + descripción opcional y una zona
// de acciones a la derecha (botón "Nuevo", etc.).
export function PageHeader({
	title,
	description,
	actions,
	className,
}: {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			<div className="space-y-1">
				<h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
					{title}
				</h1>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{actions && (
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			)}
		</div>
	);
}
