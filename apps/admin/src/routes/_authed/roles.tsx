import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";

export const Route = createFileRoute("/_authed/roles")({
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
