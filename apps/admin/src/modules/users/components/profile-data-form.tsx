import { useForm, useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { getInitials } from "@/modules/admin/lib/initials.ts";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/modules/common/components/ui/avatar.tsx";
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
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { reportError } from "@/modules/common/lib/errors.ts";
import { profileFormSchema } from "../lib/validation.ts";
import { useUpdateProfile } from "../queries/users.ts";
import type { User } from "../shared/types.ts";

// Bloque "Datos de perfil": email de solo lectura + edición de nombre e imagen
// (URL de avatar con preview en vivo). PATCH /api/users/me.
export function ProfileDataForm({ user }: { user: User }) {
	const updateProfile = useUpdateProfile();

	const form = useForm({
		defaultValues: { name: user.name, image: user.image ?? "" },
		validators: { onChange: profileFormSchema },
		onSubmit: async ({ value }) => {
			try {
				await updateProfile.mutateAsync({
					name: value.name,
					// Cadena vacía = quitar el avatar; se envía para que el IS lo limpie.
					image: value.image,
				});
				toast.success("Perfil actualizado");
			} catch (error) {
				reportError(error, "No se pudo actualizar el perfil.");
			}
		},
	});

	const name = useStore(form.store, (state) => state.values.name);
	const image = useStore(form.store, (state) => state.values.image);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Datos de perfil</CardTitle>
				<CardDescription>
					Tu nombre e imagen. El correo se cambia desde el bloque de abajo.
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
					<div className="flex items-center gap-4">
						<Avatar className="size-16">
							<AvatarImage src={image || undefined} alt={name} />
							<AvatarFallback>{getInitials(name || user.email)}</AvatarFallback>
						</Avatar>
						<div className="text-sm text-muted-foreground">
							Vista previa del avatar. Pega una URL de imagen abajo para
							cambiarlo.
						</div>
					</div>

					<Field>
						<FieldLabel htmlFor="profile-email">Correo electrónico</FieldLabel>
						<Input id="profile-email" value={user.email} readOnly disabled />
						<FieldDescription>
							El correo se cambia desde "Cambiar correo".
						</FieldDescription>
					</Field>

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
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="name"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="image">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
									URL del avatar (si no se pone se generará automáticamente)
								</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="url"
										value={field.state.value ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										placeholder="https://…"
										autoComplete="off"
									/>
									<FieldDescription>
										Deja el campo vacío para quitar el avatar.
									</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<div className="flex justify-end">
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{({ canSubmit, isSubmitting }) => (
								<Button type="submit" disabled={!canSubmit}>
									<LoadingSwap isLoading={isSubmitting}>
										Guardar cambios
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
