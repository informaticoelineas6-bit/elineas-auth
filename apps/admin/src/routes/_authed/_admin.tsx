import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveAdminContextFn } from "@/modules/admin/actions/admin.ts";
import { AdminHeader } from "@/modules/admin/components/admin-header.tsx";
import { AdminRolesError } from "@/modules/admin/components/admin-roles-error.tsx";
import { AdminShellSkeleton } from "@/modules/admin/components/admin-shell-skeleton.tsx";

export const Route = createFileRoute("/_authed/_admin")({
	// Resuelve los roles (el JWT no los trae) y guarda el acceso: sin rol admin
	// se redirige a /forbidden. Los roles quedan en el route context para los
	// hijos. Un fallo al resolverlos cae en errorComponent (no en la redirección).
	beforeLoad: async () => {
		const { roles, isAdmin } = await resolveAdminContextFn();
		if (!isAdmin) throw redirect({ to: "/forbidden" });
		return { roles, isAdmin };
	},
	pendingComponent: AdminShellSkeleton,
	errorComponent: AdminRolesError,
	component: AdminLayout,
});

function AdminLayout() {
	const { session } = Route.useRouteContext();

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			{/* Resplandor superior + rejilla sutil (temática) tras la cabecera
			    transparente. */}
			<div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent" />
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:36px_36px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]" />

			<AdminHeader session={session} />

			<main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8">
				<Outlet />
			</main>
		</div>
	);
}
