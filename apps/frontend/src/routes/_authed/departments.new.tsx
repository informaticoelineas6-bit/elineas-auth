import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { LoadingSwap } from "@/modules/common/components/ui/loading-swap.tsx";
import {
	getErrorMessage,
	getErrorStatus,
	reportError,
} from "@/modules/common/lib/errors.ts";
import { DepartmentFields } from "@/modules/departments/components/department-fields.tsx";
import {
	toDepartmentPayload,
	useCreateDepartmentForm,
} from "@/modules/departments/lib/form.ts";
import { useCreateDepartment } from "@/modules/departments/queries/departments.ts";
import { requirePermissionAccess } from "@/modules/permissions/lib/guard.ts";

export const Route = createFileRoute("/_authed/departments/new")({
	beforeLoad: ({ context }) =>
		requirePermissionAccess("departments", "write", context),
	component: NewDepartmentPage,
});

function NewDepartmentPage() {
	const navigate = useNavigate();
	const createDepartment = useCreateDepartment();
	// 409: nombre de departamento ya existente.
	const [nameError, setNameError] = useState<string | undefined>();

	const form = useCreateDepartmentForm(async (value) => {
		setNameError(undefined);
		try {
			const department = await createDepartment.mutateAsync(
				toDepartmentPayload(value),
			);
			toast.success(`Departamento "${department.name}" creado`);
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
					"No se pudo crear el departamento. Intenta nuevamente.",
				);
			}
		}
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Departamentos", to: "/departments" },
					{ label: "Nuevo" },
				]}
			/>
			<PageHeader
				title="Nuevo departamento"
				description="Crea un departamento y luego agrega a sus miembros."
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
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: "/departments" })}
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
									Crear departamento
								</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
