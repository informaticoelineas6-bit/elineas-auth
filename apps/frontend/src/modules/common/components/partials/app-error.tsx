import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { getErrorMessage } from "@/modules/common/lib/errors.ts";

// Fallback general de error. Se registra como errorComponent del root y como
// defaultErrorComponent del router, cubriendo cualquier error no manejado por
// una ruta con su propio boundary. Permite reintentar sin recargar la página.
export function AppError({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const [retrying, setRetrying] = useState(false);

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
		<div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
			<div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
				<span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
					<AlertTriangle className="size-6" />
				</span>
				<h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
					Algo salió mal
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					{getErrorMessage(
						error,
						"Ocurrió un error inesperado. Intenta nuevamente.",
					)}
				</p>
				<div className="mt-6 flex items-center justify-center gap-2">
					<Button onClick={retry} disabled={retrying}>
						{retrying ? "Reintentando…" : "Reintentar"}
					</Button>
					<Button variant="outline" asChild>
						<Link to="/">Ir al inicio</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
