import { SearchX } from "lucide-react";
import { cn } from "@/modules/common/lib/utils.ts";

// Estado inline "no encontrado" para cuando el IS responde 404 sobre un recurso
// concreto (p. ej. una ficha cuyo id ya no existe). A diferencia del NotFound
// del router, no ocupa toda la pantalla: se muestra en el lugar del contenido,
// con una acción de vuelta (normalmente al listado) que aporta el llamador.
export function NotFoundState({
	title = "No encontrado",
	description = "El recurso que buscas no existe o fue eliminado.",
	action,
	className,
}: {
	title?: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center",
				className,
			)}
		>
			<span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<SearchX className="size-6" />
			</span>
			<p className="mt-4 font-medium text-foreground">{title}</p>
			<p className="mt-1 max-w-sm text-sm text-muted-foreground">
				{description}
			</p>
			{action && <div className="mt-6">{action}</div>}
		</div>
	);
}
