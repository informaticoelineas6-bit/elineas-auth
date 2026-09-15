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

// Sección "Credenciales TKC" del alta combinada. Opera sobre el mismo form que
// UserAccountFields y EmployeeFields (ver employees/lib/form.ts), de ahí los
// nombres de campo anidados "tkc.username" / "tkc.password".
//
// Toda la sección es opcional: dejándola en blanco, el usuario se crea sin
// credenciales de TKC. Lo que no vale es rellenar solo uno de los dos campos
// —lo impide `tkcSectionSchema`— porque medio par no sirve para autenticar en
// ningún sitio.
//
// `usernameError` recibe el 409 del IS cuando ese usuario de TKC ya está
// enlazado a otra persona, para mostrarlo sobre el campo.
export function TkcFields({
	form,
	usernameError,
}: {
	form: EmployeeWithUserFormApi;
	usernameError?: string;
}) {
	return (
		<FieldSet>
			<FieldLegend>Credenciales TKC</FieldLegend>
			<FieldDescription>
				Opcionales. Son las credenciales de la persona en TKC, un sistema
				externo: el Identity Server solo las guarda cifradas y se las entrega a
				su dueño al iniciar sesión. No se usan para entrar aquí.
			</FieldDescription>
			<FieldGroup className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
				<form.Field name="tkc.username">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid || Boolean(usernameError)}>
								<FieldLabel htmlFor={field.name}>Usuario de TKC</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid || Boolean(usernameError)}
									placeholder="ada.lovelace"
									autoComplete="off"
								/>
								<FieldDescription>
									Tal cual se escribe en TKC, sin espacios alrededor. Cada
									cuenta de TKC pertenece a una sola persona.
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								{usernameError && <FieldError>{usernameError}</FieldError>}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="tkc.password">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Contraseña de TKC</FieldLabel>
								<PasswordInput
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="La contraseña que usa en TKC"
									autoComplete="off"
								/>
								<FieldDescription>
									La política de contraseña del IS no se aplica aquí: la fija
									TKC. Una vez guardada no podrás volver a verla.
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>
		</FieldSet>
	);
}
