import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	getErrorMessage,
	getErrorStatus,
} from "@/modules/common/lib/errors.ts";

// Boundary de una sección de la consola: contiene el error dentro del área de
// contenido (la cabecera y la navegación siguen vivas) en vez de tumbar toda la
// app. Un 403 se muestra como "Sin permisos"; el 401 se gestiona globalmente
// (redirección al login), así que aquí solo queda el resto con opción de
// reintentar.
export function SectionError({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const [retrying, setRetrying] = useState(false);

	if (getErrorStatus(error) === 403) {
		return <ForbiddenState />;
	}

	async function retry() {
		setRetrying(true);
		try {
			reset();
			await router.invalidate();
		} finally {
			setRetrying(false);
		}
	}

	return (
		<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
				<AlertTriangle className="size-6" />
			</span>
			<p className="mt-4 font-medium text-foreground">Algo salió mal</p>
			<p className="mt-1 max-w-sm text-sm text-muted-foreground">
				{getErrorMessage(error, "No se pudo cargar esta sección.")}
			</p>
			<Button
				variant="outline"
				className="mt-6"
				onClick={retry}
				disabled={retrying}
			>
				{retrying ? "Reintentando…" : "Reintentar"}
			</Button>
		</div>
	);
}
