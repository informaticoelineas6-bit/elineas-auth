import {
	CatchBoundary,
	createFileRoute,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import { resolveAdminContextFn } from "@/modules/admin/actions/admin.ts";
import { AdminHeader } from "@/modules/admin/components/admin-header.tsx";
import { AdminRolesError } from "@/modules/admin/components/admin-roles-error.tsx";
import { AdminShellSkeleton } from "@/modules/admin/components/admin-shell-skeleton.tsx";
import { ForbiddenScreen } from "@/modules/admin/components/forbidden-screen.tsx";
import { getSessionFn } from "@/modules/auth/actions/auth.ts";
import { SectionError } from "@/modules/common/components/partials/section-error.tsx";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const session = await getSessionFn();
		// Sesión ausente/caducada: al login, conservando la ruta para volver.
		if (!session) {
			throw redirect({ to: "/", search: { redirect: location.href } });
		}
		const { roles, isAdmin } = await resolveAdminContextFn();
		return { session, roles, isAdmin };
	},
	pendingComponent: AdminShellSkeleton,
	errorComponent: AdminRolesError,
	component: AuthedLayout,
});

function AuthedLayout() {
	const { session, isAdmin } = Route.useRouteContext();
	// Clave para reiniciar el boundary de sección al navegar (un error de una
	// sección no debe quedar "pegado" al cambiar de ruta).
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	// Autenticado pero sin rol admin: "Sin permisos" reutilizable (no se redirige,
	// para no entrar en bucle con el guard del login).
	if (!isAdmin) return <ForbiddenScreen />;

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-linear-to-b from-primary/10 to-transparent" />
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[36px_36px] opacity-40 mask-[radial-gradient(ellipse_at_top,black,transparent_65%)]" />

			<AdminHeader session={session} />

			<main className="relative z-10 mx-auto w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl px-4 py-8">
				{/* Boundary por sección: un error de una página se contiene aquí sin
				    tumbar la app ni perder la cabecera/navegación. */}
				<CatchBoundary
					getResetKey={() => pathname}
					errorComponent={SectionError}
				>
					<Outlet />
				</CatchBoundary>
			</main>
		</div>
	);
}
