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
	return (
		<div className="relative min-h-screen w-full bg-slate-950">
			<div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-size-[14px_24px]" />
			<div className="relative text-slate-50">
				<Outlet />
			</div>
		</div>
	);
}
