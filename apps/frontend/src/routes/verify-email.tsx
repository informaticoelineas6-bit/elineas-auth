import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleCheck, CircleX } from "lucide-react";
import { z } from "zod";
import { verifyEmailChangeFn } from "@/modules/auth/actions/auth.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";

// Destino del enlace de verificación de cambio de correo. Ruta PÚBLICA (fuera de
// _authed): el usuario abre el enlace desde su bandeja y puede no tener sesión.
// El token viaja en la query; el loader lo confirma contra el IS y la página
// muestra el resultado. El correo solo se aplica al llegar aquí con éxito.
export const Route = createFileRoute("/verify-email")({
	validateSearch: z.object({ token: z.string().optional() }),
	loaderDeps: ({ search }) => ({ token: search.token }),
	loader: async ({ deps }) => {
		if (!deps.token) {
			return { ok: false as const, reason: "missing" as const };
		}
		const result = await verifyEmailChangeFn({ data: { token: deps.token } });
		return result.ok
			? { ok: true as const }
			: { ok: false as const, reason: "invalid" as const, error: result.error };
	},
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const data = Route.useLoaderData();

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="w-full flex flex-col items-center text-center">
					{data.ok ? (
						<CircleCheck className="mb-2 size-10 text-primary" />
					) : (
						<CircleX className="mb-2 size-10 text-destructive" />
					)}
					<CardTitle>
						{data.ok ? "Correo verificado" : "No se pudo verificar"}
					</CardTitle>
					<CardDescription>
						{data.ok
							? "Tu nuevo correo quedó confirmado y ya es el correo de tu cuenta."
							: data.reason === "missing"
								? "El enlace no incluye un token de verificación. Ábrelo directamente desde el correo que te enviamos."
								: (data.error ??
									"El enlace no es válido o ya caducó. Solicita el cambio de correo nuevamente.")}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex justify-center">
					<Button asChild>
						<Link to="/">Ir a iniciar sesión</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
