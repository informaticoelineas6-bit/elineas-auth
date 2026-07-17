import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveAdminContextFn } from "@/modules/admin/actions/admin.ts";
import { AdminHeader } from "@/modules/admin/components/admin-header.tsx";
import { AdminRolesError } from "@/modules/admin/components/admin-roles-error.tsx";
import { AdminShellSkeleton } from "@/modules/admin/components/admin-shell-skeleton.tsx";
import { getSessionFn } from "@/modules/auth/actions/auth.ts";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session) throw redirect({ to: "/" });
		const { roles, isAdmin } = await resolveAdminContextFn();
		if (!isAdmin) throw redirect({ to: "/" });
		return { session, roles, isAdmin };
	},
	pendingComponent: AdminShellSkeleton,
	errorComponent: AdminRolesError,
	component: AuthedLayout,
});

function AuthedLayout() {
	const { session } = Route.useRouteContext();

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-linear-to-b from-primary/10 to-transparent" />
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[36px_36px] opacity-40 mask-[radial-gradient(ellipse_at_top,black,transparent_65%)]" />

			<AdminHeader session={session} />

			<main className="relative z-10 mx-auto w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl px-4 py-8">
				<Outlet />
			</main>
		</div>
	);
}
