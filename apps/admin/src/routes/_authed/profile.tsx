import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/modules/admin/components/section-placeholder.tsx";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";

export const Route = createFileRoute("/_authed/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Mi perfil" }]} />
			<PageHeader
				title="Mi perfil"
				description="Edita tus datos, cambia tu contraseña y tu correo."
			/>
			<SectionPlaceholder issue="issue #10" />
		</div>
	);
}
