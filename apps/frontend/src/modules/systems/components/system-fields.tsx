import { useRef } from "react";
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
import type { CreateSystemFormApi, SystemFormApi } from "../lib/form.ts";
import { slugify } from "../lib/form.ts";

// Campos de un sistema, compartidos por la creación y la edición. Ambos forms
// tienen la misma forma (name/slug/description/active), así que los nombres de
// campo valen para los dos.
//
// - `autoSlug` (alta): mientras el usuario no edite el slug a mano, se deriva
//   del nombre. Al tocar el slug, se deja de sincronizar.
// - `slugError` muestra el 409 de slug duplicado sobre el campo.
// - `slugWarning` (edición) advierte del impacto de cambiar un slug ya en uso.
export function SystemFields({
	form: incomingForm,
	autoSlug = false,
	slugError,
	slugWarning,
}: {
	form: SystemFormApi;
	autoSlug?: boolean;
	slugError?: string;
	slugWarning?: React.ReactNode;
}) {
	// La unión de form APIs (crear/editar) no permite renderizar <form.Field>
	// directamente (genéricos incompatibles); ambos comparten estos campos, así
	// que se opera con uno de los tipos concretos.
	const form = incomingForm as CreateSystemFormApi;
	// El slug deja de autogenerarse en cuanto el usuario lo edita a mano.
	const slugTouched = useRef(false);

	return (
		<FieldSet>
			<FieldLegend>Datos del sistema</FieldLegend>
			<FieldDescription>
				Un sistema es una aplicación que se autentica contra el Identity Server.
				Nombre y slug son obligatorios.
			</FieldDescription>
			<FieldGroup className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
				<form.Field name="name">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name} required>
									Nombre
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) => {
										const value = e.target.value;
										field.handleChange(value);
										// Sincroniza el slug con el nombre hasta que el usuario lo
										// edite manualmente (solo en el alta).
										if (autoSlug && !slugTouched.current) {
											form.setFieldValue("slug", slugify(value));
										}
									}}
									aria-invalid={isInvalid}
									placeholder="Portal de Ventas"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="slug">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid || Boolean(slugError)}>
								<FieldLabel htmlFor={field.name} required>
									Slug
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) => {
										slugTouched.current = true;
										field.handleChange(e.target.value);
									}}
									aria-invalid={isInvalid || Boolean(slugError)}
									placeholder="portal-de-ventas"
									autoComplete="off"
								/>
								<FieldDescription>
									Identificador único que las aplicaciones envían al iniciar
									sesión. Solo minúsculas, números y guiones.
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								{slugError && <FieldError>{slugError}</FieldError>}
								{slugWarning}
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
								placeholder="Para qué se usa este sistema…"
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
									Un sistema inactivo rechaza los inicios de sesión que lo usan.
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
