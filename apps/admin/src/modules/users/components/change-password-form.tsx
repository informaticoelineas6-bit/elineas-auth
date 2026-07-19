import { useForm } from "@tanstack/react-form";
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
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { PasswordInput } from "@/modules/common/components/ui/password-input.tsx";
import {
	getErrorMessage,
	getErrorRetryAfter,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { useCountdown } from "@/modules/common/lib/use-countdown.ts";
import { changePasswordFormSchema } from "../lib/validation.ts";
import { useChangePassword } from "../queries/users.ts";

// Bloque "Cambiar contraseña": exige la contraseña actual (re-autenticación) y
// una nueva con confirmación; opción de cerrar las demás sesiones. Maneja la
// contraseña actual incorrecta (sobre el campo) y el 429 con cuenta atrás.
export function ChangePasswordForm() {
	const changePassword = useChangePassword();
	const [currentError, setCurrentError] = useState<string | undefined>();
	const rateLimit = useCountdown();

	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmNewPassword: "",
			revokeOtherSessions: false,
		},
		validators: { onChange: changePasswordFormSchema },
		onSubmit: async ({ value }) => {
			setCurrentError(undefined);
			try {
				await changePassword.mutateAsync({
					currentPassword: value.currentPassword,
					newPassword: value.newPassword,
					revokeOtherSessions: value.revokeOtherSessions,
				});
				toast.success("Contraseña actualizada", {
					description: value.revokeOtherSessions
						? "Se cerró la sesión en los demás dispositivos; esta sigue activa."
						: "Tu sesión actual sigue activa.",
				});
				form.reset();
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 401 || status === 400) {
					// Re-autenticación fallida: la contraseña actual no es correcta.
					setCurrentError(
						getErrorMessage(error, "La contraseña actual no es correcta."),
					);
				} else if (status === 429) {
					rateLimit.start(getErrorRetryAfter(error) ?? 60);
					toast.error("Demasiados intentos. Espera antes de reintentar.");
				} else {
					reportError(error, "No se pudo cambiar la contraseña.");
				}
			}
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cambiar contraseña</CardTitle>
				<CardDescription>
					Por seguridad, necesitas tu contraseña actual para cambiarla.
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

					<form.Field name="newPassword">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name} required>
										Nueva contraseña
									</FieldLabel>
									<PasswordInput
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="new-password"
										placeholder="Mínimo 12 caracteres"
										showStrength
										showGenerator
										generatorLength={20}
									/>
									<FieldDescription>
										Entre 12 y 128 caracteres.
									</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="confirmNewPassword">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name} required>
										Confirmar nueva contraseña
									</FieldLabel>
									<PasswordInput
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="new-password"
										showStrength
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="revokeOtherSessions">
						{(field) => (
							<Field orientation="horizontal">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) =>
										field.handleChange(checked === true)
									}
								/>
								<FieldContent>
									<FieldLabel htmlFor={field.name}>
										Cerrar sesión en los demás dispositivos
									</FieldLabel>
									<FieldDescription>
										Tu sesión actual seguirá activa; las demás se cerrarán.
									</FieldDescription>
								</FieldContent>
							</Field>
						)}
					</form.Field>

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
											: "Cambiar contraseña"}
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
