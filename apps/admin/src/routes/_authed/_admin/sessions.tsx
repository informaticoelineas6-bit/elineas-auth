import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";

export const Route = createFileRoute("/_authed/_admin/sessions")({
	component: SessionsPage,
});

function SessionsPage() {
	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Sesiones" }]} />
			<PageHeader
				title="Sesiones"
				description="Revisa y revoca las sesiones activas de tu cuenta."
			/>
			<SectionPlaceholder issue="issue #11" />
		</div>
	);
}
