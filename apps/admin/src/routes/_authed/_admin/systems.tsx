import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";

export const Route = createFileRoute("/_authed/_admin/systems")({
	component: SystemsPage,
});

function SystemsPage() {
	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Sistemas" }]} />
			<PageHeader
				title="Sistemas"
				description="Administra los sistemas integrados con el Identity Server."
			/>
			<SectionPlaceholder issue="issue #7" />
		</div>
	);
}
