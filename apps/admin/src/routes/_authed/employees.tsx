import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";

export const Route = createFileRoute("/_authed/employees")({
	component: EmployeesPage,
});

function EmployeesPage() {
	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Empleados" }]} />
			<PageHeader
				title="Empleados"
				description="Listado, alta, edición y baja de empleados."
			/>
			<SectionPlaceholder issue="issue #4" />
		</div>
	);
}
