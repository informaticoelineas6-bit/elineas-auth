import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { roleFiltersSchema } from "@/modules/roles/lib/validation.ts";

export const Route = createFileRoute("/_authed/roles")({
	// Filtros en la URL con el mismo schema que el server fn. La ficha de un
	// sistema enlaza aquí con ?systemId=… para ver sus roles; el listado que lo
	// consuma se implementa en #8.
	validateSearch: roleFiltersSchema,
	component: RolesPage,
});

function RolesPage() {
	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Roles" }]} />
			<PageHeader
				title="Roles"
				description="Define los roles disponibles por sistema."
			/>
			<SectionPlaceholder issue="issue #8" />
		</div>
	);
}
