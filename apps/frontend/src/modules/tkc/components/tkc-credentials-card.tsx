import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/modules/common/components/partials/confirm-dialog.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import {
	Card,
	CardAction,
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
import { PasswordInput } from "@/modules/common/components/ui/password-input.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { formatDate } from "@/modules/common/lib/format.ts";
import { tkcCredentialsSchema } from "@/modules/tkc/lib/validation.ts";
import {
	tkcQueries,
	useRemoveUserTkc,
	useSetUserTkc,
} from "@/modules/tkc/queries/tkc.ts";

// Card "Credenciales TKC" de la ficha de usuario: consulta, fija y desvincula
// las credenciales del sistema externo.
//
// La contraseña NO se muestra nunca, ni siquiera enmascarada con su valor real:
// el IS no la devuelve a ninguna ruta de administración (solo al propio dueño
// al iniciar sesión). Por eso la edición es siempre un REEMPLAZO completo —hay
// que volver a escribir usuario y contraseña—, no un formulario precargado: no
// hay nada que precargar salvo el usuario.
export function TkcCredentialsCard({
	userId,
	userLabel,
	canWrite,
	canDelete,
}: {
	/** Cuenta del IS a la que se enlazan las credenciales. `null` si la ficha no tiene cuenta. */
	userId: string | null;
	userLabel: string;
	// tkc:write / tkc:delete (ver users.routes.ts): credenciales especialmente
	// sensibles, con su propio permiso separado de employees/users.
	canWrite: boolean;
	canDelete: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	if (!userId) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Credenciales TKC</CardTitle>
					<CardDescription>
						Esta persona no tiene una cuenta de usuario enlazada, así que no
						puede tener credenciales de TKC.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<TkcCard
			userId={userId}
			userLabel={userLabel}
			editing={editing}
			setEditing={setEditing}
			confirmingRemove={confirmingRemove}
			setConfirmingRemove={setConfirmingRemove}
			canWrite={canWrite}
			canDelete={canDelete}
		/>
	);
}

// Separado del envoltorio de arriba porque aquí ya hay `userId`: así los hooks
// (useQuery, useMutation) se montan siempre, sin condicionales de por medio.
function TkcCard({
	userId,
	userLabel,
	editing,
	setEditing,
	confirmingRemove,
	setConfirmingRemove,
	canWrite,
	canDelete,
}: {
	userId: string;
	userLabel: string;
	editing: boolean;
	setEditing: (value: boolean) => void;
	confirmingRemove: boolean;
	setConfirmingRemove: (value: boolean) => void;
	canWrite: boolean;
	canDelete: boolean;
}) {
	const query = useQuery(tkcQueries.byUser(userId));
	const removeTkc = useRemoveUserTkc();

	function confirmRemove() {
		removeTkc.mutate(userId, {
			onSuccess: () => {
				toast.success("Credenciales de TKC desvinculadas");
				setConfirmingRemove(false);
			},
			onError: (error) => reportError(error),
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Credenciales TKC</CardTitle>
				<CardDescription>
					Credenciales de esta persona en TKC, un sistema externo. El Identity
					Server las guarda cifradas y solo se las entrega a ella al iniciar
					sesión: desde aquí no se pueden consultar.
				</CardDescription>
				{!editing && (canWrite || (query.data && canDelete)) && (
					<CardAction className="flex gap-2">
						{canWrite && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setEditing(true)}
							>
								{query.data ? <Pencil /> : <KeyRound />}
								{query.data ? "Reemplazar" : "Enlazar"}
							</Button>
						)}
						{query.data && canDelete && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setConfirmingRemove(true)}
							>
								<Trash2 />
								Desvincular
							</Button>
						)}
					</CardAction>
				)}
			</CardHeader>

			<CardContent>
				{editing ? (
					<TkcForm
						userId={userId}
						userLabel={userLabel}
						hasExisting={Boolean(query.data)}
						onDone={() => setEditing(false)}
					/>
				) : query.isPending ? (
					<Skeleton className="h-10 w-full" />
				) : query.isError ? (
					<p className="text-sm text-muted-foreground">
						{getErrorMessage(query.error, "No se pudieron cargar.")}
					</p>
				) : query.data ? (
					<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Usuario de TKC
							</dt>
							<dd className="text-sm text-foreground">{query.data.username}</dd>
						</div>
						<div className="space-y-1">
							<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Última actualización
							</dt>
							<dd className="text-sm text-foreground">
								{formatDate(query.data.updatedAt)}
							</dd>
						</div>
					</dl>
				) : (
					<p className="text-sm text-muted-foreground">
						Sin credenciales de TKC.
					</p>
				)}
			</CardContent>

			<ConfirmDialog
				open={confirmingRemove}
				onOpenChange={(open) => !open && setConfirmingRemove(false)}
				title="Desvincular credenciales de TKC"
				description={`"${userLabel}" dejará de recibir sus credenciales de TKC al iniciar sesión. La cuenta en TKC no se toca: esto solo deshace el enlace guardado aquí.`}
				confirmLabel="Desvincular"
				destructive
				loading={removeTkc.isPending}
				onConfirm={confirmRemove}
			/>
		</Card>
	);
}

function TkcForm({
	userId,
	userLabel,
	hasExisting,
	onDone,
}: {
	userId: string;
	userLabel: string;
	hasExisting: boolean;
	onDone: () => void;
}) {
	const setTkc = useSetUserTkc();
	const [usernameError, setUsernameError] = useState<string | undefined>();

	// Arranca SIEMPRE en blanco, también al reemplazar unas existentes: el IS no
	// devuelve la contraseña, así que precargar el usuario y dejar la contraseña
	// vacía sugeriría que se puede cambiar solo uno de los dos, y no se puede
	// (el PUT reemplaza el par completo).
	const form = useForm({
		defaultValues: { username: "", password: "" },
		validators: { onChange: tkcCredentialsSchema },
		onSubmit: async ({ value }) => {
			setUsernameError(undefined);
			try {
				await setTkc.mutateAsync({ userId, ...value });
				toast.success(`Credenciales de TKC guardadas para "${userLabel}"`);
				form.reset();
				onDone();
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 503) {
					// El servidor no tiene TKC_SECRET_KEY: sin ella no puede cifrarlas.
					// Es configuración del despliegue, no un fallo de lo introducido.
					toast.error(
						getErrorMessage(
							error,
							"El servidor no puede guardar credenciales de TKC ahora mismo.",
						),
					);
				} else if (status === 409 || status === 400) {
					// 409: ese usuario de TKC ya está enlazado a otra persona (una cuenta
					// del sistema externo pertenece a una sola). 400: no cumple el
					// formato. En ambos casos el problema está en este campo.
					setUsernameError(getErrorMessage(error));
				} else {
					reportError(error, "No se pudieron guardar las credenciales.");
				}
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<form.Field name="username">
				{(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid || Boolean(usernameError)}>
							<FieldLabel htmlFor={field.name} required>
								Usuario de TKC
							</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => {
									setUsernameError(undefined);
									field.handleChange(e.target.value);
								}}
								aria-invalid={isInvalid || Boolean(usernameError)}
								placeholder="ada.lovelace"
								autoComplete="off"
							/>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
							{usernameError && <FieldError>{usernameError}</FieldError>}
						</Field>
					);
				}}
			</form.Field>

			<form.Field name="password">
				{(field) => {
					const isInvalid =
						field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel htmlFor={field.name} required>
								Contraseña de TKC
							</FieldLabel>
							<PasswordInput
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={isInvalid}
								autoComplete="off"
							/>
							<FieldDescription>
								{hasExisting
									? "Reemplaza el par completo: hay que escribir de nuevo usuario y contraseña, porque la guardada no se puede consultar."
									: "La política de contraseña del IS no se aplica aquí: la fija TKC."}
							</FieldDescription>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					);
				}}
			</form.Field>

			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						form.reset();
						onDone();
					}}
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
						<Button type="submit" disabled={!canSubmit}>
							<LoadingSwap isLoading={isSubmitting}>Guardar</LoadingSwap>
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}
