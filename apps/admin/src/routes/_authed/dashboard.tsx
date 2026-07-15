import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logoutFn } from "@/lib/auth/functions";

export const Route = createFileRoute("/_authed/dashboard")({
	component: Dashboard,
});

function Dashboard() {
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const logout = useServerFn(logoutFn);

	const mutation = useMutation({
		mutationFn: () => logout(),
		onSuccess: () => navigate({ to: "/login" }),
	});

	return (
		<div className="p-8">
			<p className="text-lg">
				Sesión iniciada como {session.email ?? session.userId}
			</p>
			<button
				type="button"
				onClick={() => mutation.mutate()}
				disabled={mutation.isPending}
				className="mt-4 rounded bg-black p-2 text-white disabled:opacity-50"
			>
				{mutation.isPending ? "Saliendo…" : "Cerrar sesión"}
			</button>
		</div>
	);
}
