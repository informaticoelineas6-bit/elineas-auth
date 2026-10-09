import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CircleX } from "lucide-react";
import { z } from "zod";
import { completeGoogleLoginFn } from "@/modules/auth/actions/auth.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";

// Destino al que el IS devuelve al usuario tras el login con Google:
// `?code=...&state=...` si todo fue bien o `?error=CODIGO` si no. Ruta PÚBLICA
// (aún no hay sesión). El loader canjea el código en el servidor y, si va bien,
// redirige al panel; solo se renderiza la página si hubo un error. El código es
// de un solo uso y el loader corre una vez (SSR), no hay preload porque ningún
// <Link> apunta aquí.
export const Route = createFileRoute("/auth/google/callback")({
	validateSearch: z.object({
		code: z.string().optional(),
		state: z.string().optional(),
		error: z.string().optional(),
	}),
	// El código viaja en la query: que no se filtre por Referer a terceros.
	head: () => ({ meta: [{ name: "referrer", content: "no-referrer" }] }),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const result = await completeGoogleLoginFn({ data: deps });
		if (result.ok) throw redirect({ to: "/dashboard" });
		return { error: result.error };
	},
	component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
	const { error } = Route.useLoaderData();
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="w-full flex flex-col items-center text-center">
					<CircleX className="mb-2 size-10 text-destructive" />
					<CardTitle>No se pudo iniciar sesión</CardTitle>
					<CardDescription>{error}</CardDescription>
				</CardHeader>
				<CardContent className="flex justify-center">
					<Button asChild>
						<Link to="/">Volver al inicio de sesión</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
