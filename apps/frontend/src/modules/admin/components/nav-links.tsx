import { Link } from "@tanstack/react-router";
import { cn } from "@/modules/common/lib/utils.ts";
import { NAV_ITEMS } from "../shared/navigation.ts";

// Lista de enlaces de sección, reutilizada en la barra de escritorio y en la
// fila desplazable de móvil. El estado activo se pinta con data-[status=active]
// que TanStack Router añade al enlace de la ruta actual. `items` viene ya
// filtrado por permisos (ver `visibleNavItems` en shared/navigation.ts); por
// defecto es la lista completa, para quien no necesite filtrar.
export function NavLinks({
	className,
	items = NAV_ITEMS,
}: {
	className?: string;
	items?: readonly (typeof NAV_ITEMS)[number][];
}) {
	return (
		<>
			{items.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					className={cn(
						"group inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap transition-colors hover:bg-accent/60 hover:text-foreground",
						"data-[status=active]:bg-accent data-[status=active]:font-semibold data-[status=active]:text-accent-foreground",
						className,
					)}
				>
					<item.icon className="size-4" />
					<span>{item.label}</span>
				</Link>
			))}
		</>
	);
}
