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
import { PhoneInput } from "@/modules/common/components/ui/phone-input.tsx";
import { Switch } from "@/modules/common/components/ui/switch.tsx";
import { Textarea } from "@/modules/common/components/ui/textarea.tsx";
import { todayIsoDate } from "@/modules/common/lib/validation.ts";
import type {
	EditEmployeeFormApi,
	EmployeeWithUserFormApi,
} from "../lib/form.ts";

// Sección "Empleado" compartida por el alta combinada y la edición: ambos
// formularios anidan sus valores bajo `employee`, así que los nombres de campo
// ("employee.name", …) valen para los dos. Solo nombre, apellidos y CI son
// obligatorios; el resto es opcional. `ciError` recibe el 409 de CI duplicado.
export function EmployeeFields({
	form: incomingForm,
	ciError,
}: {
	form: EmployeeWithUserFormApi | EditEmployeeFormApi;
	ciError?: string;
}) {
	// TS no permite renderizar <form.Field> sobre una unión de form APIs
	// (TS2604: los genéricos de cada form producen componentes incompatibles).
	// Ambos forms comparten el subárbol `employee` —lo único que este componente
	// usa—, así que se opera con el tipo del form de edición, el más estrecho.
	const form = incomingForm as EditEmployeeFormApi;
	return (
		<FieldSet>
			<FieldLegend>Datos personales</FieldLegend>
			<FieldDescription>
				Ficha de la persona. Solo nombre, apellidos y CI son obligatorios.
			</FieldDescription>
			<FieldGroup className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
				<form.Field name="employee.name">
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
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Ada"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="employee.lastName">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name} required>
									Apellidos
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Lovelace"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="employee.ci">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid || Boolean(ciError)}>
								<FieldLabel htmlFor={field.name} required>
									CI
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid || Boolean(ciError)}
									placeholder="12345678"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								{ciError && <FieldError>{ciError}</FieldError>}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="employee.phoneNumber">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Teléfono</FieldLabel>
								<PhoneInput
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={field.handleChange}
									aria-invalid={isInvalid}
									placeholder="+53 5 1234567"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="employee.birthday">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>
									Fecha de nacimiento
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="date"
									max={todayIsoDate()}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="employee.inDate">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Fecha de alta</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="date"
									max={todayIsoDate()}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.employee.inDate}>
					{(inDate) => (
						<form.Field name="employee.outDate">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Fecha de baja</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="date"
											max={todayIsoDate()}
											min={inDate || undefined}
											value={field.state.value ?? ""}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
					)}
				</form.Subscribe>

				<form.Field name="employee.address">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>Dirección</FieldLabel>
							<Textarea
								id={field.name}
								name={field.name}
								value={field.state.value ?? ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Calle, número, municipio…"
								rows={2}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="employee.active">
					{(field) => (
						<Field orientation="horizontal">
							<FieldContent>
								<FieldLabel htmlFor={field.name}>Activo</FieldLabel>
								<FieldDescription>
									Un usuario inactivo no puede iniciar sesión en los sistemas.
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
