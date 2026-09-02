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
import { SystemFields } from "@/modules/systems/components/system-fields.tsx";
import {
	toSystemPayload,
	useCreateSystemForm,
} from "@/modules/systems/lib/form.ts";
import { useCreateSystem } from "@/modules/systems/queries/systems.ts";

export const Route = createFileRoute("/_authed/systems/new")({
	component: NewSystemPage,
});

function NewSystemPage() {
	const navigate = useNavigate();
	const createSystem = useCreateSystem();
	// 409 del IS al crear con un slug ya existente: se muestra sobre el campo.
	const [slugError, setSlugError] = useState<string | undefined>();

	const form = useCreateSystemForm(async (value) => {
		setSlugError(undefined);
		try {
			const system = await createSystem.mutateAsync(toSystemPayload(value));
			toast.success(`Sistema "${system.name}" creado`);
			navigate({ to: "/systems/$systemId", params: { systemId: system.id } });
		} catch (error) {
			const status = getErrorStatus(error);
			if (status === 409) {
				setSlugError(
					getErrorMessage(error, "Ya existe un sistema con ese slug"),
				);
			} else if (status === 429) {
				toast.error(
					"Demasiados intentos. Espera unos segundos antes de reintentar.",
				);
			} else {
				reportError(error, "No se pudo crear el sistema. Intenta nuevamente.");
			}
		}
	});

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[{ label: "Sistemas", to: "/systems" }, { label: "Nuevo" }]}
			/>
			<PageHeader
				title="Nuevo sistema"
				description="Registra una aplicación que se autenticará contra el Identity Server."
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="w-full"
			>
				<SystemFields form={form} autoSlug slugError={slugError} />

				<div className="mt-8 flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: "/systems" })}
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
									Crear sistema
								</LoadingSwap>
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
