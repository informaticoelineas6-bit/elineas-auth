import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ForbiddenState } from "@/modules/common/components/partials/forbidden-state.tsx";
import { NotFoundState } from "@/modules/common/components/partials/not-found-state.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { EmployeeFields } from "@/modules/employees/components/employee-fields.tsx";
import {
	employeeToFormValues,
	toUpdateEmployeePayload,
	useEditEmployeeForm,
} from "@/modules/employees/lib/form.ts";
import {
	employeesQueries,
	useUpdateEmployee,
} from "@/modules/employees/queries/employees.ts";
import type { Employee } from "@/modules/employees/shared/types.ts";

export const Route = createFileRoute("/_authed/employees/$employeeId/edit")({
	// Prefetch del detalle (misma query key) para calentar hover/SSR.
	loader: ({ context: { queryClient }, params }) =>
		queryClient.prefetchQuery(employeesQueries.detail(params.employeeId)),
	component: EditEmployeePage,
});

function EditEmployeePage() {
	const { employeeId } = Route.useParams();
	const query = useQuery(employeesQueries.detail(employeeId));

	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Usuarios", to: "/employees" },
					{
						label: query.data
							? `${query.data.name} ${query.data.lastName}`
							: "Detalle",
					},
					{ label: "Editar" },
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Usuario no encontrado"
					description="El usuario que quieres editar no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/employees">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description="No tienes permisos para editar este usuario." />
			) : query.isError ? (
				<NotFoundState
					title="No se pudo cargar la ficha"
					description={getErrorMessage(query.error)}
					action={
						<Button variant="outline" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					}
				/>
			) : query.isPending ? (
				<div className="space-y-6">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-96 rounded-xl" />
				</div>
			) : (
				<EditEmployeeForm employee={query.data} />
			)}
		</div>
	);
}

// Formulario separado de la página para montarse solo con la ficha ya cargada:
// useForm fija los defaultValues en el primer render.
function EditEmployeeForm({ employee }: { employee: Employee }) {
	const navigate = useNavigate();
	const updateEmployee = useUpdateEmployee();
	// 409 del IS al cambiar el CI a uno ya existente: se muestra sobre el campo.
	const [ciError, setCiError] = useState<string | undefined>();

	const form = useEditEmployeeForm(
		employeeToFormValues(employee),
		async (value) => {
			setCiError(undefined);
			try {
				await updateEmployee.mutateAsync({
					id: employee.id,
					input: toUpdateEmployeePayload(value),
				});
				toast.success("Cambios guardados");
				navigate({
					to: "/employees/$employeeId",
					params: { employeeId: employee.id },
				});
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 409) {
					setCiError(getErrorMessage(error, "Ya existe un usuario con ese CI"));
				} else if (status === 429) {
					toast.error(
						"Demasiados intentos. Espera unos segundos antes de reintentar.",
					);
				} else {
					reportError(
						error,
						"No se pudieron guardar los cambios. Intenta nuevamente.",
					);
				}
			}
		},
	);

	function goBackToDetail() {
		navigate({
			to: "/employees/$employeeId",
			params: { employeeId: employee.id },
		});
	}

	return (
		<>
			<PageHeader
				title="Editar usuario"
				description="Actualiza los datos del usuario. Los cambios se reflejan en el listado al guardar."
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="w-full"
			>
				<EmployeeFields form={form} ciError={ciError} />

				<div className="mt-8 flex justify-end gap-2">
					<Button type="button" variant="outline" onClick={goBackToDetail}>
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
									Guardar cambios
								</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</>
	);
}
