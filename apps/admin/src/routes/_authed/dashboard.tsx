import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { signOutFn } from "#/actions/auth.ts";
import { reportError } from "#/lib/errors.ts";

export const Route = createFileRoute("/_authed/dashboard")({
	component: Dashboard,
});

function Dashboard() {
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const logout = useServerFn(signOutFn);

	const mutation = useMutation({
		mutationFn: () => logout(),
		onSuccess: () => navigate({ to: "/" }),
		onError: (error) =>
			reportError(error, "No se pudo cerrar sesión. Intenta nuevamente."),
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
