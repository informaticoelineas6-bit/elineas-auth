import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { setPasswordFn } from "@/modules/auth/actions/auth.ts";
import { setPasswordSchema } from "@/modules/auth/lib/validation.ts";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { PasswordInput } from "@/modules/common/components/ui/password-input.tsx";

// Destino del enlace de invitación del correo. Ruta PÚBLICA (fuera de _authed):
// la persona aún no tiene contraseña ni sesión. A diferencia de /verify-email,
// el token NO se consume al cargar la página (un loader GET lo quemaría un
// escáner de correo que precargue el enlace): solo se envía al pulsar el botón.
export const Route = createFileRoute("/set-password")({
	validateSearch: z.object({ token: z.string().optional() }),
	// El token viaja en la query: que no se filtre por Referer a terceros.
	head: () => ({ meta: [{ name: "referrer", content: "no-referrer" }] }),
	component: SetPasswordPage,
});

function SetPasswordPage() {
	const { token } = Route.useSearch();
	const [newPassword, setNewPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | undefined>();
	const [fatal, setFatal] = useState<string | undefined>();
	const [done, setDone] = useState(false);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(undefined);
		if (newPassword !== confirm) {
			setError("Las contraseñas no coinciden");
			return;
		}
		const parsed = setPasswordSchema.safeParse({ token, newPassword });
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Datos no válidos");
			return;
		}
		setPending(true);
		try {
			const result = await setPasswordFn({ data: parsed.data });
			if (result.ok) setDone(true);
			else
				setFatal(
					"El enlace no es válido, ya se usó o caducó. Pide a un administrador que te reenvíe la invitación.",
				);
		} finally {
			setPending(false);
		}
	}

	const failed = !token || fatal !== undefined;

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="w-full flex flex-col items-center text-center">
					{done ? (
						<CircleCheck className="mb-2 size-10 text-primary" />
					) : failed ? (
						<CircleX className="mb-2 size-10 text-destructive" />
					) : null}
					<CardTitle>
						{done
							? "Contraseña establecida"
							: failed
								? "No se pudo continuar"
								: "Activa tu cuenta"}
					</CardTitle>
					<CardDescription>
						{done
							? "Ya puedes iniciar sesión con tu correo y tu nueva contraseña."
							: failed
								? (fatal ??
									"El enlace no incluye un token. Ábrelo directamente desde el correo que te enviamos.")
								: "Elige la contraseña con la que vas a iniciar sesión."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{done || failed ? (
						<div className="flex justify-center">
							<Button asChild>
								<Link to="/">Ir a iniciar sesión</Link>
							</Button>
						</div>
					) : (
						<form onSubmit={onSubmit} className="space-y-4">
							<Field data-invalid={!!error}>
								<FieldLabel htmlFor="newPassword" required>
									Nueva contraseña
								</FieldLabel>
								<PasswordInput
									id="newPassword"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									autoComplete="new-password"
									placeholder="Mínimo 12 caracteres"
									showStrength
									showGenerator
									generatorLength={20}
								/>
								<FieldDescription>Entre 12 y 128 caracteres.</FieldDescription>
							</Field>
							<Field data-invalid={!!error}>
								<FieldLabel htmlFor="confirm" required>
									Confirmar contraseña
								</FieldLabel>
								<PasswordInput
									id="confirm"
									value={confirm}
									onChange={(e) => setConfirm(e.target.value)}
									autoComplete="new-password"
									placeholder="Repite la contraseña"
								/>
								{error && <FieldError>{error}</FieldError>}
							</Field>
							<Button type="submit" className="w-full" disabled={pending}>
								<LoadingSwap isLoading={pending}>
									Establecer contraseña
								</LoadingSwap>
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
