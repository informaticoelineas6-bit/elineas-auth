import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/modules/common/components/ui/tabs.tsx";
import {
	getErrorCode,
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { EmployeeFields } from "@/modules/employees/components/employee-fields.tsx";
import {
	toCreateEmployeeWithUserPayload,
	useEmployeeWithUserForm,
} from "@/modules/employees/lib/form.ts";
import { useCreateEmployeeWithUser } from "@/modules/employees/queries/employees.ts";
import { TkcFields } from "@/modules/tkc/components/tkc-fields.tsx";
import { UserAccountFields } from "@/modules/users/components/user-account-fields.tsx";

export const Route = createFileRoute("/_authed/employees/new")({
	component: NewEmployeePage,
});

function NewEmployeePage() {
	const navigate = useNavigate();
	const createEmployee = useCreateEmployeeWithUser();
	// Errores del IS mapeados al campo correspondiente (409 email/CI duplicado).
	const [fieldErrors, setFieldErrors] = useState<{
		email?: string;
		ci?: string;
		tkcUsername?: string;
	}>({});

	const form = useEmployeeWithUserForm(async (value) => {
		setFieldErrors({});
		try {
			const { user, employee } = await createEmployee.mutateAsync(
				toCreateEmployeeWithUserPayload(value),
			);
			toast.success(`Usuario "${employee.name} ${employee.lastName}" creado`, {
				description:
					"Asígnale un rol para que pueda iniciar sesión en algún sistema.",
				action: {
					label: "Asignar rol",
					onClick: () =>
						navigate({ to: "/user-roles", search: { userId: user.id } }),
				},
			});
			navigate({ to: "/employees" });
		} catch (error) {
			const status = getErrorStatus(error);
			if (status === 409) {
				// Duplicado: se muestra sobre el campo, sin perder lo tecleado. El
				// usuario de TKC se distingue por `code` y no por el texto —el IS lo
				// devuelve explícitamente— porque la heurística sobre el mensaje solo
				// sabe separar CI de email.
				const message = getErrorMessage(error);
				if (getErrorCode(error) === "TKC_USERNAME_TAKEN") {
					setFieldErrors({ tkcUsername: message });
				} else if (message.toUpperCase().includes("CI")) {
					setFieldErrors({ ci: message });
				} else {
					setFieldErrors({ email: message });
				}
			} else if (status === 503) {
				// El alta trae credenciales de TKC pero el servidor no tiene con qué
				// cifrarlas. El IS rechaza la operación entera antes de crear nada,
				// así que no queda ningún usuario a medio configurar.
				toast.error(
					getErrorMessage(
						error,
						"El servidor no puede guardar credenciales de TKC ahora mismo.",
					),
					{
						description:
							"Crea el usuario sin ellas y enlázalas después desde su ficha.",
					},
				);
			} else if (status === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(error, "No se pudo crear el usuario. Intenta nuevamente.");
			}
		}
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[{ label: "Usuarios", to: "/employees" }, { label: "Nuevo" }]}
			/>
			<PageHeader
				title="Nuevo usuario"
				description="Crea la cuenta de usuario y sus datos personales en una sola operación."
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="w-full"
			>
				<Tabs defaultValue="user" className="gap-6">
					<TabsList>
						<TabsTrigger value="user">Cuenta de usuario</TabsTrigger>
						<TabsTrigger value="employee">Datos personales</TabsTrigger>
						<TabsTrigger value="tkc">Credenciales TKC</TabsTrigger>
					</TabsList>
					<TabsContent value="user">
						<UserAccountFields form={form} emailError={fieldErrors.email} />
					</TabsContent>
					<TabsContent value="employee">
						<EmployeeFields form={form} ciError={fieldErrors.ci} />
					</TabsContent>
					<TabsContent value="tkc">
						<TkcFields form={form} usernameError={fieldErrors.tkcUsername} />
					</TabsContent>
				</Tabs>

				<div className="mt-8 flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: "/employees" })}
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
								<LoadingSwap isLoading={isSubmitting}>
									Crear usuario
								</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
