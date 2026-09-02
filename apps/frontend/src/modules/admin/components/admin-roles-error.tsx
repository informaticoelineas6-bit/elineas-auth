import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { signOutFn } from "@/modules/auth/actions/auth.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { getErrorMessage } from "@/modules/common/lib/errors.ts";

// Estado de error del layout _admin: se muestra si falla la resolución de roles
// (p. ej. el IS no responde). Permite reintentar sin recargar o cerrar sesión.
export function AdminRolesError({ error }: ErrorComponentProps) {
	const router = useRouter();
	const logout = useServerFn(signOutFn);
	const [retrying, setRetrying] = useState(false);

	async function retry() {
		setRetrying(true);
		try {
			await router.invalidate();
		} finally {
			setRetrying(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
				<span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
					<AlertTriangle className="size-6" />
				</span>
				<h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
					No se pudieron cargar tus permisos
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					{getErrorMessage(
						error,
						"Ocurrió un error al verificar tu acceso a la consola.",
					)}
				</p>
				<div className="mt-6 flex items-center justify-center gap-2">
					<Button onClick={retry} disabled={retrying}>
						{retrying ? "Reintentando…" : "Reintentar"}
					</Button>
					<Button
						variant="outline"
						onClick={() => logout().then(() => router.navigate({ to: "/" }))}
					>
						Cerrar sesión
					</Button>
				</div>
			</div>
		</div>
	);
}
