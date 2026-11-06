import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/common/components/ui/button.tsx";
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
	FieldError,
	FieldLabel,
} from "@/modules/common/components/ui/field.tsx";
import { Input } from "@/modules/common/components/ui/input.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { inviteUserSchema } from "../lib/validation.ts";
import { useInviteUser } from "../queries/user-roles.ts";

// Alta por invitación: el IS crea la cuenta y envía al correo el enlace para que
// la persona fije su contraseña (quien invita nunca la ve ni la elige). Pueden
// usarlo el superadmin y los admins de sistema; después se le asigna un rol
// desde "Asignar rol".
export function InviteUserDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invitar usuario</DialogTitle>
					<DialogDescription>
						Crea la cuenta y envía un correo para que fije su contraseña.
						Después podrás asignarle un rol.
					</DialogDescription>
				</DialogHeader>
				{/* Solo montado abierto: reinicia el formulario en cada apertura. */}
				{open && <InviteUserForm onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function InviteUserForm({ onDone }: { onDone: () => void }) {
	const invite = useInviteUser();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
	const [serverError, setServerError] = useState<string | undefined>();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setServerError(undefined);
		const parsed = inviteUserSchema.safeParse({
			name: name.trim(),
			email: email.trim(),
		});
		if (!parsed.success) {
			const fieldErrors = parsed.error.flatten().fieldErrors;
			setErrors({
				name: fieldErrors.name?.[0],
				email: fieldErrors.email?.[0],
			});
			return;
		}
		setErrors({});
		invite.mutate(parsed.data, {
			onSuccess: (user) => {
				toast.success(`Invitación enviada a ${user.email}`);
				onDone();
			},
			onError: (error) => {
				const status = getErrorStatus(error);
				if (status === 409 || status === 422 || status === 400) {
					setServerError(
						getErrorMessage(error, "No se pudo crear la cuenta."),
					);
				} else {
					reportError(error, "No se pudo invitar al usuario.");
				}
			},
		});
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<Field data-invalid={Boolean(errors.name)}>
				<FieldLabel htmlFor="invite-name" required>
					Nombre
				</FieldLabel>
				<Input
					id="invite-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					aria-invalid={Boolean(errors.name)}
					autoComplete="off"
				/>
				{errors.name && <FieldError>{errors.name}</FieldError>}
			</Field>
			<Field data-invalid={Boolean(errors.email)}>
				<FieldLabel htmlFor="invite-email" required>
					Correo
				</FieldLabel>
				<Input
					id="invite-email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-invalid={Boolean(errors.email)}
					autoComplete="off"
				/>
				{errors.email && <FieldError>{errors.email}</FieldError>}
			</Field>
			{serverError && <FieldError className="text-sm">{serverError}</FieldError>}
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Cancelar
				</Button>
				<Button type="submit" disabled={invite.isPending}>
					<LoadingSwap isLoading={invite.isPending}>Invitar</LoadingSwap>
				</Button>
			</DialogFooter>
		</form>
	);
}
