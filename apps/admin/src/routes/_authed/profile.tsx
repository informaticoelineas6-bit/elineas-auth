import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Button } from "@/modules/common/components/ui/button.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { getErrorMessage } from "@/modules/common/lib/errors.ts";
import { ChangeEmailForm } from "@/modules/users/components/change-email-form.tsx";
import { ChangePasswordForm } from "@/modules/users/components/change-password-form.tsx";
import { MyRolesCard } from "@/modules/users/components/my-roles-card.tsx";
import { ProfileDataForm } from "@/modules/users/components/profile-data-form.tsx";
import { usersQueries } from "@/modules/users/queries/users.ts";

export const Route = createFileRoute("/_authed/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const me = useQuery(usersQueries.me());

	return (
		<div className="space-y-6">
			<PageBreadcrumb items={[{ label: "Mi perfil" }]} />
			<PageHeader
				title="Mi perfil"
				description="Edita tus datos, cambia tu contraseña y tu correo."
			/>

			{me.isPending ? (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Skeleton className="h-96 rounded-xl" />
					<Skeleton className="h-96 rounded-xl" />
				</div>
			) : me.isError ? (
				<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
					<p className="font-medium text-foreground">
						No se pudo cargar tu perfil
					</p>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						{getErrorMessage(me.error)}
					</p>
					<Button
						variant="outline"
						className="mt-6"
						onClick={() => me.refetch()}
					>
						Reintentar
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
					<ProfileDataForm user={me.data} />
					<MyRolesCard />
					<ChangePasswordForm />
					<ChangeEmailForm currentEmail={me.data.email} />
				</div>
			)}
		</div>
	);
}
