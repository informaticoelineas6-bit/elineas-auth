import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/lib/auth/functions";

// Layout sin path propio: toda ruta bajo routes/_authed/* pasa primero por
// este beforeLoad. Se ejecuta tanto en SSR como en navegaciones client-side
// (getSessionFn siempre corre en el servidor, cookies incluidas).
export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session) throw redirect({ to: "/login" });
		return { session };
	},
	component: Outlet,
});
