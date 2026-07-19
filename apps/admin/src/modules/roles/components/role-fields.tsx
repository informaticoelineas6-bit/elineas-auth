import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { Textarea } from "@/modules/common/components/ui/textarea.tsx";
import type { EditRoleFormApi, RoleFormApi } from "../lib/form.ts";

// Campos comunes de un rol (nombre y descripción), compartidos por el alta y la
// edición. El `systemId` no vive aquí: en el alta lo aporta un selector aparte
// y en la edición no es modificable. `nameError` muestra el 409 de nombre
// duplicado dentro del mismo sistema sobre el campo.
export function RoleFields({
	form: incomingForm,
	nameError,
}: {
	form: RoleFormApi;
	nameError?: string;
}) {
	// La unión de form APIs (crear/editar) no permite renderizar <form.Field>
	// directamente; ambos comparten name/description, así que se opera con un
	// tipo concreto.
	const form = incomingForm as EditRoleFormApi;

	return (
		<FieldGroup className="w-full grid grid-cols-1 gap-6">
			<form.Field name="name">
				{(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid || Boolean(nameError)}>
							<FieldLabel htmlFor={field.name} required>
								Nombre
							</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value ?? ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={isInvalid || Boolean(nameError)}
								placeholder="Administrador"
								autoComplete="off"
							/>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
							{nameError && <FieldError>{nameError}</FieldError>}
						</Field>
					);
				}}
			</form.Field>

			<form.Field name="description">
				{(field) => (
					<Field>
						<FieldLabel htmlFor={field.name}>Descripción</FieldLabel>
						<Textarea
							id={field.name}
							name={field.name}
							value={field.state.value ?? ""}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Qué puede hacer quien tenga este rol…"
							rows={3}
						/>
					</Field>
				)}
			</form.Field>
		</FieldGroup>
	);
}
