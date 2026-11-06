import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { Switch } from "@/modules/common/components/ui/switch.tsx";
import { Textarea } from "@/modules/common/components/ui/textarea.tsx";
import type {
	CreateDepartmentFormApi,
	DepartmentFormApi,
} from "../lib/form.ts";

// Campos de un departamento, compartidos por la creación y la edición.
// `nameError` muestra el 409 de nombre duplicado sobre el campo.
export function DepartmentFields({
	form: incomingForm,
	nameError,
}: {
	form: DepartmentFormApi;
	nameError?: string;
}) {
	// Ambos forms comparten forma; se opera con uno de los tipos concretos.
	const form = incomingForm as CreateDepartmentFormApi;

	return (
		<FieldSet>
			<FieldLegend>Datos del departamento</FieldLegend>
			<FieldDescription>
				Agrupa a las personas de la organización. El nombre es obligatorio y
				único.
			</FieldDescription>
			<FieldGroup className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
				<form.Field name="name">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field
								data-invalid={isInvalid || Boolean(nameError)}
								className="md:col-span-2"
							>
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
									placeholder="Almacén central"
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
						<Field className="md:col-span-2">
							<FieldLabel htmlFor={field.name}>Descripción</FieldLabel>
							<Textarea
								id={field.name}
								name={field.name}
								value={field.state.value ?? ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Qué hace este departamento…"
								rows={3}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="active">
					{(field) => (
						<Field orientation="horizontal" className="md:col-span-2">
							<FieldContent>
								<FieldLabel htmlFor={field.name}>Activo</FieldLabel>
								<FieldDescription>
									Un departamento inactivo se conserva con sus miembros.
								</FieldDescription>
							</FieldContent>
							<Switch
								id={field.name}
								checked={field.state.value ?? false}
								onCheckedChange={(checked) => field.handleChange(checked)}
							/>
						</Field>
					)}
				</form.Field>
			</FieldGroup>
		</FieldSet>
	);
}
