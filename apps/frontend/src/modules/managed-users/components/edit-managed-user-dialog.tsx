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
import { PhoneInput } from "@/modules/common/components/ui/phone-input.tsx";
import { Switch } from "@/modules/common/components/ui/switch.tsx";
import { Textarea } from "@/modules/common/components/ui/textarea.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { updateManagedUserSchema } from "../lib/validation.ts";
import { useUpdateManagedUser } from "../queries/managed-users.ts";
import type { ManagedUser, UpdateManagedUserInput } from "../shared/types.ts";

// Edita los datos de un usuario de MI sistema: nombre y correo de la cuenta y,
// si tiene ficha de empleado, su nombre, CI, teléfono, dirección y estado. El
// IS solo lo permite si todos los roles del usuario están en sistemas que
// administras (la lista ya marca `editable`; aquí no se ofrece si no lo es).
export function EditManagedUserDialog({
	user,
	onOpenChange,
}: {
	user: ManagedUser | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={user !== null} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar usuario</DialogTitle>
					<DialogDescription>
						Cambios sobre la cuenta de {user?.email}. Si cambias el correo, el
						usuario deberá volver a verificarlo.
					</DialogDescription>
				</DialogHeader>
				{/* Solo montado con usuario: reinicia el formulario en cada apertura. */}
				{user && (
					<EditForm user={user} onDone={() => onOpenChange(false)} />
				)}
			</DialogContent>
		</Dialog>
	);
}

type Errors = Record<string, string | undefined>;

function EditForm({ user, onDone }: { user: ManagedUser; onDone: () => void }) {
	const update = useUpdateManagedUser();
	const emp = user.employee;
	const [name, setName] = useState(user.name);
	const [email, setEmail] = useState(user.email);
	const [empName, setEmpName] = useState(emp?.name ?? "");
	const [lastName, setLastName] = useState(emp?.lastName ?? "");
	const [ci, setCi] = useState(emp?.ci ?? "");
	const [phone, setPhone] = useState(emp?.phoneNumber ?? "");
	const [address, setAddress] = useState(emp?.address ?? "");
	const [active, setActive] = useState(emp?.active ?? true);
	const [errors, setErrors] = useState<Errors>({});
	const [serverError, setServerError] = useState<string | undefined>();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setServerError(undefined);

		// Solo viaja lo que cambió: evita pisar campos y reduce lo que valida el IS.
		const body: UpdateManagedUserInput = {};
		if (name.trim() !== user.name) body.name = name.trim();
		if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
			body.email = email.trim();
		}
		if (emp) {
			const employee: NonNullable<UpdateManagedUserInput["employee"]> = {};
			if (empName.trim() !== emp.name) employee.name = empName.trim();
			if (lastName.trim() !== emp.lastName) employee.lastName = lastName.trim();
			if (ci.trim() !== (emp.ci ?? "") && ci.trim()) employee.ci = ci.trim();
			if (phone.trim() !== (emp.phoneNumber ?? "") && phone.trim()) {
				employee.phoneNumber = phone.trim();
			}
			if (address.trim() !== (emp.address ?? "") && address.trim()) {
				employee.address = address.trim();
			}
			if (active !== emp.active) employee.active = active;
			if (Object.keys(employee).length > 0) body.employee = employee;
		}

		if (Object.keys(body).length === 0) {
			onDone();
			return;
		}

		const parsed = updateManagedUserSchema.safeParse(body);
		if (!parsed.success) {
			const next: Errors = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path[issue.path.length - 1];
				if (typeof key === "string" && !next[key]) next[key] = issue.message;
			}
			setErrors(next);
			return;
		}
		setErrors({});
		update.mutate(
			{ id: user.id, body: parsed.data },
			{
				onSuccess: () => {
					toast.success("Usuario actualizado");
					onDone();
				},
				onError: (error) => {
					const status = getErrorStatus(error);
					if (status === 409 || status === 403 || status === 400) {
						setServerError(
							getErrorMessage(error, "No se pudo actualizar el usuario."),
						);
					} else {
						reportError(error, "No se pudo actualizar el usuario.");
					}
				},
			},
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<Field data-invalid={Boolean(errors.name && !emp)}>
				<FieldLabel htmlFor="mu-name">Nombre de la cuenta</FieldLabel>
				<Input
					id="mu-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					aria-invalid={Boolean(errors.name)}
					autoComplete="off"
				/>
				{errors.name && !emp && <FieldError>{errors.name}</FieldError>}
			</Field>
			<Field data-invalid={Boolean(errors.email)}>
				<FieldLabel htmlFor="mu-email">Correo</FieldLabel>
				<Input
					id="mu-email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-invalid={Boolean(errors.email)}
					autoComplete="off"
				/>
				{errors.email && <FieldError>{errors.email}</FieldError>}
			</Field>

			{emp ? (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={Boolean(errors.name)}>
							<FieldLabel htmlFor="mu-emp-name">Nombre</FieldLabel>
							<Input
								id="mu-emp-name"
								value={empName}
								onChange={(e) => setEmpName(e.target.value)}
								aria-invalid={Boolean(errors.name)}
							/>
							{errors.name && <FieldError>{errors.name}</FieldError>}
						</Field>
						<Field data-invalid={Boolean(errors.lastName)}>
							<FieldLabel htmlFor="mu-emp-last">Apellidos</FieldLabel>
							<Input
								id="mu-emp-last"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								aria-invalid={Boolean(errors.lastName)}
							/>
							{errors.lastName && <FieldError>{errors.lastName}</FieldError>}
						</Field>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={Boolean(errors.ci)}>
							<FieldLabel htmlFor="mu-ci">CI</FieldLabel>
							<Input
								id="mu-ci"
								value={ci}
								onChange={(e) => setCi(e.target.value)}
								inputMode="numeric"
								aria-invalid={Boolean(errors.ci)}
							/>
							{errors.ci && <FieldError>{errors.ci}</FieldError>}
						</Field>
						<Field data-invalid={Boolean(errors.phoneNumber)}>
							<FieldLabel htmlFor="mu-phone">Teléfono</FieldLabel>
							<PhoneInput
								id="mu-phone"
								value={phone}
								onChange={setPhone}
								placeholder="+53 5 1234567"
								aria-invalid={Boolean(errors.phoneNumber)}
								autoComplete="off"
							/>
							{errors.phoneNumber && (
								<FieldError>{errors.phoneNumber}</FieldError>
							)}
						</Field>
					</div>
					<Field data-invalid={Boolean(errors.address)}>
						<FieldLabel htmlFor="mu-address">Dirección</FieldLabel>
						<Textarea
							id="mu-address"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							rows={2}
						/>
						{errors.address && <FieldError>{errors.address}</FieldError>}
					</Field>
					<label
						htmlFor="mu-active"
						className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
					>
						<span>
							<span className="block font-medium">Acceso activo</span>
							<span className="block text-xs text-muted-foreground">
								Desactivarlo cierra sus sesiones y le impide iniciar sesión en
								cualquier sistema.
							</span>
						</span>
						<Switch id="mu-active" checked={active} onCheckedChange={setActive} />
					</label>
				</>
			) : (
				<p className="text-xs text-muted-foreground">
					Esta cuenta no tiene ficha de empleado: solo se pueden editar el
					nombre y el correo.
				</p>
			)}

			{serverError && <FieldError className="text-sm">{serverError}</FieldError>}
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Cancelar
				</Button>
				<Button type="submit" disabled={update.isPending}>
					<LoadingSwap isLoading={update.isPending}>Guardar</LoadingSwap>
				</Button>
			</DialogFooter>
		</form>
	);
}
