import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Boxes,
	CircleUser,
	MonitorSmartphone,
	ShieldCheck,
	UserCog,
	Users,
} from "lucide-react";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { employeesQueries } from "@/modules/employees/queries/employees.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import { userRolesQueries } from "@/modules/user-roles/queries/user-roles.ts";

export const Route = createFileRoute("/_authed/dashboard")({
	component: Dashboard,
});

function Dashboard() {
	const { session } = Route.useRouteContext();

	// Contadores en vivo a partir del `total` de paginación (limit=1 para no
	// traer filas). Cada tarjeta gestiona su propia carga/error sin bloquear.
	const employees = useQuery({
		...employeesQueries.list({ limit: 1 }),
		select: (data) => data.pagination.total,
	});
	const systems = useQuery({
		...systemsQueries.list({ limit: 1 }),
		select: (data) => data.pagination.total,
	});
	const roles = useQuery({
		...rolesQueries.list({ limit: 1 }),
		select: (data) => data.pagination.total,
	});
	const userRoles = useQuery({
		...userRolesQueries.list({ limit: 1 }),
		select: (data) => data.pagination.total,
	});

	const stats = [
		{ to: "/employees", label: "Empleados", icon: Users, query: employees },
		{ to: "/systems", label: "Sistemas", icon: Boxes, query: systems },
		{ to: "/roles", label: "Roles", icon: ShieldCheck, query: roles },
		{
			to: "/user-roles",
			label: "Asignaciones",
			icon: UserCog,
			query: userRoles,
		},
	] as const;

	const quickLinks = [
		{
			to: "/sessions",
			label: "Sesiones",
			description: "Revisa y revoca tus dispositivos activos.",
			icon: MonitorSmartphone,
		},
		{
			to: "/profile",
			label: "Mi perfil",
			description: "Edita tus datos, contraseña y correo.",
			icon: CircleUser,
		},
	] as const;

	const firstName = (session.name ?? session.email ?? "").split(/\s+/)[0];

	return (
		<div className="space-y-8">
			<PageHeader
				title={firstName ? `Hola, ${firstName}` : "Consola de administración"}
				description="Gestiona empleados, sistemas, roles y accesos del Identity Server."
			/>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">Resumen</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{stats.map((stat) => (
						<Link
							key={stat.to}
							to={stat.to}
							className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
						>
							<div className="flex items-center justify-between">
								<span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<stat.icon className="size-5" />
								</span>
								<ArrowRight className="size-4 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
							</div>
							<div className="mt-4">
								{stat.query.isLoading ? (
									<Skeleton className="h-9 w-16" />
								) : (
									<p className="font-heading text-3xl font-semibold text-foreground">
										{stat.query.isError ? "—" : (stat.query.data ?? 0)}
									</p>
								)}
								<p className="text-sm text-muted-foreground">{stat.label}</p>
							</div>
						</Link>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					Accesos rápidos
				</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					{quickLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
						>
							<span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<link.icon className="size-5" />
							</span>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-foreground">{link.label}</p>
								<p className="truncate text-sm text-muted-foreground">
									{link.description}
								</p>
							</div>
							<ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
						</Link>
					))}
				</div>
			</section>
		</div>
	);
}
