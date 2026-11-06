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
import { deferOnClient } from "@/modules/common/lib/query.ts";
import { DepartmentFields } from "@/modules/departments/components/department-fields.tsx";
import {
	departmentToFormValues,
	toDepartmentPayload,
	useEditDepartmentForm,
} from "@/modules/departments/lib/form.ts";
import {
	departmentsQueries,
	useUpdateDepartment,
} from "@/modules/departments/queries/departments.ts";
import type { Department } from "@/modules/departments/shared/types.ts";
import { requirePermissionAccess } from "@/modules/permissions/lib/guard.ts";

export const Route = createFileRoute("/_authed/departments/$departmentId/edit")(
	{
		beforeLoad: ({ context }) =>
			requirePermissionAccess("departments", "write", context),
		// Prefetch del detalle (misma query key) para calentar hover/SSR.
		loader: ({ context: { queryClient }, params }) =>
			deferOnClient(
				queryClient.prefetchQuery(
					departmentsQueries.detail(params.departmentId),
				),
			),
		component: EditDepartmentPage,
	},
);

function EditDepartmentPage() {
	const { departmentId } = Route.useParams();
	const query = useQuery(departmentsQueries.detail(departmentId));

	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Departamentos", to: "/departments" },
					{ label: query.data ? query.data.name : "Detalle" },
					{ label: "Editar" },
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Departamento no encontrado"
					description="El departamento que quieres editar no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/departments">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description={getErrorMessage(query.error)} />
			) : query.isError ? (
				<NotFoundState
					title="No se pudo cargar el departamento"
					description={getErrorMessage(query.error)}
					action={
						<Button variant="outline" onClick={() => query.refetch()}>
							Reintentar
						</Button>
					}
				/>
			) : query.isPending ? (
				<div className="space-y-6">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-96 rounded-xl" />
				</div>
			) : (
				<EditDepartmentForm department={query.data} />
			)}
		</div>
	);
}

function EditDepartmentForm({ department }: { department: Department }) {
	const navigate = useNavigate();
	const updateDepartment = useUpdateDepartment();
	const [nameError, setNameError] = useState<string | undefined>();

	const form = useEditDepartmentForm(
		departmentToFormValues(department),
		async (value) => {
			setNameError(undefined);
			try {
				await updateDepartment.mutateAsync({
					id: department.id,
					input: toDepartmentPayload(value),
				});
				toast.success("Cambios guardados");
				navigate({
					to: "/departments/$departmentId",
					params: { departmentId: department.id },
				});
			} catch (error) {
				const status = getErrorStatus(error);
				if (status === 409) {
					setNameError(
						getErrorMessage(error, "Ya existe un departamento con ese nombre"),
					);
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
			to: "/departments/$departmentId",
			params: { departmentId: department.id },
		});
	}

	return (
		<>
			<PageHeader
				title="Editar departamento"
				description="Actualiza los datos del departamento. Los cambios se reflejan al guardar."
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="w-full"
			>
				<DepartmentFields form={form} nameError={nameError} />

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
