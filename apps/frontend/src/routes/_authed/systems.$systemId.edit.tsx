import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
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
import { SystemFields } from "@/modules/systems/components/system-fields.tsx";
import {
	systemToFormValues,
	toSystemPayload,
	useEditSystemForm,
} from "@/modules/systems/lib/form.ts";
import {
	systemsQueries,
	useUpdateSystem,
} from "@/modules/systems/queries/systems.ts";
import type { System } from "@/modules/systems/shared/types.ts";

export const Route = createFileRoute("/_authed/systems/$systemId/edit")({
	// Prefetch del detalle (misma query key) para calentar hover/SSR.
	loader: ({ context: { queryClient }, params }) =>
		queryClient.prefetchQuery(systemsQueries.detail(params.systemId)),
	component: EditSystemPage,
});

function EditSystemPage() {
	const { systemId } = Route.useParams();
	const query = useQuery(systemsQueries.detail(systemId));

	const status = getErrorStatus(query.error);

	return (
		<div className="space-y-6">
			<PageBreadcrumb
				items={[
					{ label: "Sistemas", to: "/systems" },
					{ label: query.data ? query.data.name : "Detalle" },
					{ label: "Editar" },
				]}
			/>

			{status === 404 ? (
				<NotFoundState
					title="Sistema no encontrado"
					description="El sistema que quieres editar no existe o fue eliminado."
					action={
						<Button asChild variant="outline">
							<Link to="/systems">Volver al listado</Link>
						</Button>
					}
				/>
			) : status === 403 ? (
				<ForbiddenState description="No tienes permisos para editar este sistema." />
			) : query.isError ? (
				<NotFoundState
					title="No se pudo cargar el sistema"
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
				<EditSystemForm system={query.data} />
			)}
		</div>
	);
}

function EditSystemForm({ system }: { system: System }) {
	const navigate = useNavigate();
	const updateSystem = useUpdateSystem();
	const [slugError, setSlugError] = useState<string | undefined>();

	const form = useEditSystemForm(systemToFormValues(system), async (value) => {
		setSlugError(undefined);
		try {
			await updateSystem.mutateAsync({
				id: system.id,
				input: toSystemPayload(value),
			});
			toast.success("Cambios guardados");
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
				reportError(
					error,
					"No se pudieron guardar los cambios. Intenta nuevamente.",
				);
			}
		}
	});

	function goBackToDetail() {
		navigate({ to: "/systems/$systemId", params: { systemId: system.id } });
	}

	return (
		<>
			<PageHeader
				title="Editar sistema"
				description="Actualiza los datos del sistema. Los cambios se reflejan al guardar."
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="w-full"
			>
				<SystemFields
					form={form}
					slugError={slugError}
					slugWarning={
						// El aviso solo aparece si el slug difiere del original: cambiarlo
						// rompe el login de las aplicaciones que ya lo usan.
						<form.Subscribe selector={(state) => state.values.slug}>
							{(slug) =>
								slug !== system.slug ? (
									<p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500">
										<TriangleAlert className="mt-0.5 size-4 shrink-0" />
										<span>
											Cambiar el slug hará que las aplicaciones que usan{" "}
											<code className="font-mono">{system.slug}</code> en el
											login dejen de funcionar hasta que las actualices.
										</span>
									</p>
								) : null
							}
						</form.Subscribe>
					}
				/>

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
