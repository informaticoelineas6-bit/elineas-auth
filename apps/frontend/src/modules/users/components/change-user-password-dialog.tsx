import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Checkbox } from "@/modules/common/components/ui/checkbox.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/modules/common/components/ui/dialog.tsx";
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
	getErrorStatus,
	reportError,
	reportRateLimited,
} from "@/modules/common/lib/errors.ts";
import { useCountdown } from "@/modules/common/lib/use-countdown.ts";
import { adminChangePasswordFormSchema } from "../lib/validation.ts";
import { useAdminChangeUserPassword } from "../queries/users.ts";

// Diálogo para fijar la contraseña de OTRO usuario. Un único componente para
// las dos entradas —la ficha del usuario y la fila del listado— para no
// duplicar el formulario ni su manejo de errores.
//
// La re-autenticación se pide sobre la contraseña DEL ADMIN: él no conoce la
// del usuario. Sin esta barrera, una sesión de admin robada bastaría para
// apropiarse de cualquier cuenta del IS.
export function ChangeUserPasswordDialog({
	open,
	onOpenChange,
	userId,
	userLabel,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Usuario cuya contraseña se cambia. */
	userId: string;
	/** Nombre o correo, solo para que el diálogo diga a quién afecta. */
	userLabel: string;
}) {
	const changePassword = useAdminChangeUserPassword();
	const [currentError, setCurrentError] = useState<string | undefined>();
	const rateLimit = useCountdown();

	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmNewPassword: "",
			// Marcada por defecto: un reseteo suele responder a una contraseña
			// comprometida, y sin revocar, quien ya estuviera dentro seguiría dentro.
			revokeSessions: true,
		},
		validators: { onChange: adminChangePasswordFormSchema },
		onSubmit: async ({ value }) => {
			setCurrentError(undefined);
			try {
				const result = await changePassword.mutateAsync({
					userId,
					currentPassword: value.currentPassword,
					newPassword: value.newPassword,
					revokeSessions: value.revokeSessions,
				});
				toast.success(`Contraseña de "${userLabel}" actualizada`, {
					description:
						result.revokedSessions > 0
							? `Se cerraron ${result.revokedSessions} ${
									result.revokedSessions === 1 ? "sesión" : "sesiones"
								} y tendrá que volver a iniciar sesión.`
							: "No tenía sesiones abiertas.",
				});
				form.reset();
				onOpenChange(false);
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 401) {
					// Re-autenticación fallida: TU contraseña de admin no es correcta.
					// Es un 401 del propio IS, no una sesión caducada.
					setCurrentError(
						getErrorMessage(error, "Tu contraseña no es correcta."),
					);
				} else if (status === 403) {
					toast.error("Necesitas rol de administrador para hacer esto.");
				} else if (status === 409) {
					// El usuario no tiene contraseña local (account de credenciales).
					toast.error(
						getErrorMessage(
							error,
							"Este usuario no tiene contraseña local, así que no se puede cambiar.",
						),
					);
				} else if (status === 429) {
					reportRateLimited(error, rateLimit.start);
				} else {
					reportError(error, "No se pudo cambiar la contraseña.");
				}
			}
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				// Al cerrar se descarta lo tecleado: son credenciales, no un borrador
				// que interese conservar entre aperturas.
				if (!next) {
					form.reset();
					setCurrentError(undefined);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Cambiar contraseña</DialogTitle>
					<DialogDescription>
						Fija una contraseña nueva para <strong>{userLabel}</strong>. Tendrás
						que comunicársela por un canal seguro: no se envía ningún correo.
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-6"
				>
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
										Entre 12 y 128 caracteres, con mayúscula, minúscula y un
										carácter especial.
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

					<form.Field name="revokeSessions">
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
										Cerrar sus sesiones activas
									</FieldLabel>
									<FieldDescription>
										Recomendado: si no se cierran, quien ya estuviera dentro
										seguirá dentro pese al cambio.
									</FieldDescription>
								</FieldContent>
							</Field>
						)}
					</form.Field>

					<form.Field name="currentPassword">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid || Boolean(currentError)}>
									<FieldLabel htmlFor={field.name} required>
										Tu contraseña
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
									<FieldDescription>
										La tuya, no la del usuario: confirma que eres quien dice ser
										antes de una acción sensible.
									</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									{currentError && <FieldError>{currentError}</FieldError>}
								</Field>
							);
						}}
					</form.Field>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
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
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
