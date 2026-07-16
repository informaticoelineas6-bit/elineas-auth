import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveAdminContextFn } from "@/modules/admin/actions/admin.ts";
import { AdminHeader } from "@/modules/admin/components/admin-header.tsx";
import { AdminRolesError } from "@/modules/admin/components/admin-roles-error.tsx";
import { AdminShellSkeleton } from "@/modules/admin/components/admin-shell-skeleton.tsx";
import { ForbiddenScreen } from "@/modules/admin/components/forbidden-screen.tsx";
import { getSessionFn } from "@/modules/auth/actions/auth.ts";

export const Route = createFileRoute("/_authed")({
	// Guard único de toda la consola: exige sesión (si no, al login) y resuelve
	// los roles (el JWT no los trae) para saber si es admin. Ambos quedan en el
	// route context. La resolución de roles se refleja en pending/error abajo.
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session) throw redirect({ to: "/" });
		const { roles, isAdmin } = await resolveAdminContextFn();
		return { session, roles, isAdmin };
	},
	pendingComponent: AdminShellSkeleton,
	errorComponent: AdminRolesError,
	component: AuthedLayout,
});

function AuthedLayout() {
	const { session, isAdmin } = Route.useRouteContext();

	// Sin rol admin: no se muestra la navegación, solo la pantalla de permisos.
	if (!isAdmin) return <ForbiddenScreen />;

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			{/* Resplandor superior + rejilla sutil (temática) tras la cabecera
			    transparente. */}
			<div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-linear-to-b from-primary/10 to-transparent" />
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[36px_36px] opacity-40 mask-[radial-gradient(ellipse_at_top,black,transparent_65%)]" />

			<AdminHeader session={session} />

			<main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8">
				<Outlet />
			</main>
		</div>
	);
}
