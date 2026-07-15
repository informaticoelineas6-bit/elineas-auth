import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { loginFn } from "@/lib/auth/functions";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
	const navigate = useNavigate();
	const login = useServerFn(loginFn);
	const [formError, setFormError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: (data: { email: string; password: string }) => login({ data }),
		onSuccess: (result) => {
			if ("error" in result) {
				setFormError(result.error ?? "Error de autenticación");
				return;
			}
			navigate({ to: "/" });
		},
	});

	return (
		<div className="mx-auto mt-24 max-w-sm p-8">
			<h1 className="text-2xl font-bold">Iniciar sesión</h1>
			<form
				className="mt-6 flex flex-col gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					setFormError(null);
					const form = new FormData(event.currentTarget);
					mutation.mutate({
						email: String(form.get("email")),
						password: String(form.get("password")),
					});
				}}
			>
				<input
					name="email"
					type="email"
					placeholder="Email"
					required
					className="rounded border p-2"
				/>
				<input
					name="password"
					type="password"
					placeholder="Contraseña"
					required
					className="rounded border p-2"
				/>
				{formError ? <p className="text-sm text-red-600">{formError}</p> : null}
				<button
					type="submit"
					disabled={mutation.isPending}
					className="rounded bg-black p-2 text-white disabled:opacity-50"
				>
					{mutation.isPending ? "Entrando…" : "Entrar"}
				</button>
			</form>
		</div>
	);
}
