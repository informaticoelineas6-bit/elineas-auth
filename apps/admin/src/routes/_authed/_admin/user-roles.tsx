import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";

export const Route = createFileRoute("/_authed/_admin/user-roles")({
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
