import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { userRoleFiltersSchema } from "@/modules/user-roles/lib/validation.ts";

export const Route = createFileRoute("/_authed/user-roles")({
	// Filtros en la URL con el mismo schema que el server fn. El atajo "Gestionar
	// roles" de la ficha de empleado llega aquí con ?userId=…; el listado que lo
	// consuma se implementa en #9.
	validateSearch: userRoleFiltersSchema,
	component: UserRolesPage,
});

function UserRolesPage() {
	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Asignaciones" }]} />
			<PageHeader
				title="Asignaciones"
				description="Asigna y revoca roles a los usuarios."
			/>
			<SectionPlaceholder issue="issue #9" />
		</div>
	);
}
