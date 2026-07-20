import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
	FieldError,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { PasswordInput } from "@/modules/common/components/ui/password-input.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
	reportRateLimited,
} from "@/modules/common/lib/errors.ts";
import { useCountdown } from "@/modules/common/lib/use-countdown.ts";
import { changeEmailSchema } from "../lib/validation.ts";
import { useChangeEmail } from "../queries/users.ts";

// Bloque "Cambiar correo": exige la contraseña actual (única barrera, el IS lo
// aplica sin verificación previa). Explica el estado de verificación del nuevo
// correo según la respuesta e invalida la sesión en cache para refrescar la
// cabecera. `currentEmail` es el correo vigente (solo para el texto).
export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
	const router = useRouter();
	const changeEmail = useChangeEmail();
	const [currentError, setCurrentError] = useState<string | undefined>();
	// Aviso de éxito: correo aplicado o pendiente de verificación.
	const [result, setResult] = useState<
		{ email: string; verified: boolean } | undefined
	>();
	const rateLimit = useCountdown();

	const form = useForm({
		defaultValues: { newEmail: "", currentPassword: "" },
		validators: { onChange: changeEmailSchema },
		onSubmit: async ({ value }) => {
			setCurrentError(undefined);
			setResult(undefined);
			try {
				const response = await changeEmail.mutateAsync({
					newEmail: value.newEmail,
					currentPassword: value.currentPassword,
				});
				// Si el IS devuelve el usuario ya con el correo nuevo, el cambio fue
				// inmediato; si no, queda pendiente de verificación por correo.
				const applied = response.user?.email === value.newEmail;
				setResult({ email: value.newEmail, verified: applied });
				toast.success(applied ? "Correo actualizado" : "Verificación enviada");
				form.reset();
				// Refresca la sesión que alimenta la cabecera (email mostrado).
				await router.invalidate();
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 401 || status === 400) {
					setCurrentError(
						getErrorMessage(error, "La contraseña actual no es correcta."),
					);
				} else if (status === 429) {
					reportRateLimited(error, rateLimit.start);
				} else {
					reportError(error, "No se pudo cambiar el correo.");
				}
			}
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cambiar correo</CardTitle>
				<CardDescription>
					Correo actual: <span className="font-medium">{currentEmail}</span>.
					Necesitas tu contraseña para cambiarlo.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-6"
				>
					<form.Field name="newEmail">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name} required>
										Nuevo correo
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="email"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										placeholder="nuevo@mercadoelineas.com"
										autoComplete="off"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="currentPassword">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid || Boolean(currentError)}>
									<FieldLabel htmlFor={field.name} required>
										Contraseña actual
									</FieldLabel>
									<PasswordInput
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => {
											setCurrentError(undefined);
											field.handleChange(e.target.value);
										}}
										aria-invalid={isInvalid || Boolean(currentError)}
										autoComplete="current-password"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									{currentError && <FieldError>{currentError}</FieldError>}
								</Field>
							);
						}}
					</form.Field>

					{result && (
						<div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
							<MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
							<span>
								{result.verified ? (
									<>
										Tu correo se actualizó a{" "}
										<span className="font-medium">{result.email}</span>.
									</>
								) : (
									<>
										Enviamos un enlace de verificación para{" "}
										<span className="font-medium">{result.email}</span>. El
										cambio se aplicará cuando lo confirmes desde tu bandeja de
										entrada.
									</>
								)}
							</span>
						</div>
					)}

					<div className="flex justify-end">
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{({ canSubmit, isSubmitting }) => (
								<Button type="submit" disabled={!canSubmit || rateLimit.active}>
									<LoadingSwap isLoading={isSubmitting}>
										{rateLimit.active
											? `Espera ${rateLimit.remaining}s`
											: "Cambiar correo"}
									</LoadingSwap>
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
