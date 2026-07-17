import { ShieldAlert } from "lucide-react";
import { cn } from "@/modules/common/lib/utils.ts";

// Estado inline "sin permisos" para cuando el IS responde 403 sobre un recurso
// concreto (el usuario está autenticado y es admin de consola, pero no tiene
// permiso para este recurso). A diferencia de ForbiddenScreen, no cierra sesión
// ni ocupa toda la pantalla: se muestra en el lugar del contenido. Reutilizable
// por todos los listados administrativos.
export function ForbiddenState({
	title = "Sin permisos",
	description = "No tienes permisos para ver este recurso. Si crees que es un error, contacta con un administrador.",
	className,
}: {
	title?: string;
	description?: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center",
				className,
			)}
		>
			<span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
				<ShieldAlert className="size-6" />
			</span>
			<p className="mt-4 font-medium text-foreground">{title}</p>
			<p className="mt-1 max-w-sm text-sm text-muted-foreground">
				{description}
			</p>
		</div>
	);
}
