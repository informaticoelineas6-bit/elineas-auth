import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { PasswordInput } from "@/modules/common/components/ui/password-input.tsx";
import type { EmployeeWithUserFormApi } from "@/modules/employees/lib/form.ts";

// Sección "Cuenta de usuario" del alta combinada. Vive en el módulo `users`
// porque describe la cuenta del IS (name/email/password); opera sobre el form
// compartido del alta (ver employees/lib/form.ts). `emailError` recibe el 409
// de email duplicado devuelto por el IS para mostrarlo sobre el campo.
export function UserAccountFields({
	form,
	emailError,
}: {
	form: EmployeeWithUserFormApi;
	emailError?: string;
}) {
	return (
		<FieldSet>
			<FieldLegend>Cuenta de usuario</FieldLegend>
			<FieldDescription>
				Credenciales con las que la persona iniciará sesión en el Identity
				Server.
			</FieldDescription>
			<FieldGroup className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
				<form.Field name="user.name">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name} required>
									Nombre visible de la cuenta
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Ada Lovelace"
									autoComplete="off"
								/>
								<FieldDescription>
									Nombre que identifica la cuenta (distinto del nombre de pila
									del empleado).
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="user.email">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid || Boolean(emailError)}>
								<FieldLabel htmlFor={field.name} required>
									Correo electrónico
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid || Boolean(emailError)}
									placeholder="ada@mercadoelineas.com"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								{emailError && <FieldError>{emailError}</FieldError>}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="user.password">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name} required>
									Contraseña
								</FieldLabel>
								<PasswordInput
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Mínimo 12 caracteres"
									autoComplete="new-password"
									showStrength
									showGenerator
									generatorLength={20}
								/>
								<FieldDescription>Entre 12 y 128 caracteres.</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name} required>
									Confirmar contraseña
								</FieldLabel>
								<PasswordInput
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Repite la contraseña"
									autoComplete="new-password"
									showStrength
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>
		</FieldSet>
	);
}
