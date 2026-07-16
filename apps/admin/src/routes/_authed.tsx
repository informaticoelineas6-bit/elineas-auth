import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/modules/auth/actions/auth.ts";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session) throw redirect({ to: "/" });
		return { session };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	// Envoltorio mínimo y consciente del tema; cada layout hijo (p. ej. _admin)
	// aporta su propia decoración de fondo y cabecera.
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Outlet />
		</div>
	);
}
