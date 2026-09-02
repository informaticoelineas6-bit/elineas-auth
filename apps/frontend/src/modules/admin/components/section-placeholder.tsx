import { Construction } from "lucide-react";

// Marcador temporal para las secciones cuya UI llega en issues posteriores
// (#4–#11). La navegación y el guard ya funcionan; aquí solo falta el contenido.
export function SectionPlaceholder({ issue }: { issue?: string }) {
	return (
		<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
				<Construction className="size-6" />
			</span>
			<p className="mt-4 font-medium text-foreground">
				Sección en construcción
			</p>
			<p className="mt-1 max-w-sm text-sm text-muted-foreground">
				La interfaz de esta sección se implementará próximamente
				{issue ? ` (${issue})` : ""}. La navegación y el control de acceso ya
				están activos.
			</p>
		</div>
	);
}
