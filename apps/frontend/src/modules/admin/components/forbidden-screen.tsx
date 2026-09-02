import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { signOutFn } from "@/modules/auth/actions/auth.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";

// Pantalla "sin permisos" que se muestra dentro de _authed cuando el usuario
// autenticado no tiene rol admin. Se renderiza en línea (no es una ruta) para
// no depender de una redirección que provocaría un bucle con el guard.
export function ForbiddenScreen() {
	const router = useRouter();
	const logout = useServerFn(signOutFn);

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
				<span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
					<ShieldAlert className="size-6" />
				</span>
				<h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
					Sin permisos
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Tu cuenta no tiene el rol de administrador necesario para acceder a la
					consola. Si crees que es un error, contacta con un administrador.
				</p>
				<div className="mt-6 flex items-center justify-center">
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
