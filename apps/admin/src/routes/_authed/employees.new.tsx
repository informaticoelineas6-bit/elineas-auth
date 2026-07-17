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
	}>({});

	const form = useEmployeeWithUserForm(async (value) => {
		setFieldErrors({});
		try {
			const { user, employee } = await createEmployee.mutateAsync(
				toCreateEmployeeWithUserPayload(value),
			);
			toast.success(`Empleado "${employee.name} ${employee.lastName}" creado`, {
				description:
					"Asígnale un rol para que pueda iniciar sesión en algún sistema.",
				action: {
					label: "Asignar rol",
					onClick: () =>
						toast.info("Asignación de roles disponible en #9", {
							description: `Pendiente para ${user.email}.`,
						}),
				},
			});
			navigate({ to: "/employees" });
		} catch (error) {
			const status = getErrorStatus(error);
			if (status === 409) {
				// CI o email duplicado: se muestra sobre el campo, sin perder lo tecleado.
				const message = getErrorMessage(error);
				if (message.toUpperCase().includes("CI")) {
					setFieldErrors({ ci: message });
				} else {
					setFieldErrors({ email: message });
				}
			} else if (status === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(error, "No se pudo crear el empleado. Intenta nuevamente.");
			}
		}
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[{ label: "Empleados", to: "/employees" }, { label: "Nuevo" }]}
			/>
			<PageHeader
				title="Nuevo empleado"
				description="Crea la cuenta de usuario y su empleado enlazado en una sola operación."
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
						<TabsTrigger value="employee">Dato del empleado</TabsTrigger>
					</TabsList>
					<TabsContent value="user">
						<UserAccountFields form={form} emailError={fieldErrors.email} />
					</TabsContent>
					<TabsContent value="employee">
						<EmployeeFields form={form} ciError={fieldErrors.ci} />
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
									Crear empleado
								</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
