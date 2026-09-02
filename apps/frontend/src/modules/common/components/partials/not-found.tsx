import { Link, useRouter } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { Button } from "@/modules/common/components/ui/button.tsx";

// Fallback general de "página no encontrada" (404). Se registra en el root del
// router, así que cubre cualquier ruta inexistente de la app.
export function NotFound() {
	const router = useRouter();

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
			<div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
				<span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
					<Compass className="size-6" />
				</span>
				<p className="mt-4 font-heading text-5xl font-semibold text-foreground">
					404
				</p>
				<h1 className="mt-1 font-heading text-xl font-semibold text-foreground">
					Página no encontrada
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					La página que buscas no existe o fue movida.
				</p>
				<div className="mt-6 flex items-center justify-center gap-2">
					<Button variant="outline" onClick={() => router.history.back()}>
						Volver atrás
					</Button>
					<Button asChild>
						<Link to="/">Ir al inicio</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
