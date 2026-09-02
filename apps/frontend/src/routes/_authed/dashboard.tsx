import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BookOpen,
	Boxes,
	CircleUser,
	KeyRound,
	Layers,
	MonitorSmartphone,
	ShieldCheck,
	ShieldPlus,
	ShieldQuestion,
	UserCog,
	UserPlus,
	Users,
} from "lucide-react";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import { Skeleton } from "@/modules/common/components/ui/skeleton.tsx";
import { cn } from "@/modules/common/lib/utils.ts";
import { employeesQueries } from "@/modules/employees/queries/employees.ts";
import { rolesQueries } from "@/modules/roles/queries/roles.ts";
import { systemsQueries } from "@/modules/systems/queries/systems.ts";
import { userRolesQueries } from "@/modules/user-roles/queries/user-roles.ts";

// Un acento de color por tarjeta (tokens --chart-N ya definidos en
// styles.css), para que el resumen se pueda escanear de un vistazo en vez de
// leer cuatro tarjetas idénticas en azul.
const STAT_TINTS = [
	{ bg: "bg-chart-1/10", text: "text-chart-1" },
	{ bg: "bg-chart-2/10", text: "text-chart-2" },
	{ bg: "bg-chart-3/10", text: "text-chart-3" },
	{ bg: "bg-chart-4/10", text: "text-chart-4" },
] as const;

export const Route = createFileRoute("/_authed/dashboard")({
	// Prefetch de los 4 contadores: con preload "intent" se calientan al pasar el
	// cursor y en SSR viajan con la página, evitando el waterfall montaje→fetch.
	// prefetchQuery (no ensureQueryData) no lanza en error: cada tarjeta sigue
	// gestionando su propio estado de carga/error.
	loader: ({ context: { queryClient } }) =>
		Promise.all([
			queryClient.prefetchQuery(employeesQueries.list({ limit: 1 })),
			queryClient.prefetchQuery(systemsQueries.list({ limit: 1 })),
			queryClient.prefetchQuery(rolesQueries.list({ limit: 1 })),
			queryClient.prefetchQuery(userRolesQueries.list({ limit: 1 })),
		]),
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
		{ to: "/employees", label: "Usuarios", icon: Users, query: employees },
		{ to: "/systems", label: "Sistemas", icon: Boxes, query: systems },
		{ to: "/roles", label: "Roles", icon: ShieldCheck, query: roles },
		{
			to: "/user-roles",
			label: "Asignaciones",
			icon: UserCog,
			query: userRoles,
		},
	] as const;

	// Atajos de creación: el destino habitual tras revisar el Resumen es dar de
	// alta algo. Separados de "Accesos rápidos" (navegación) porque son
	// acciones, no vistas.
	const quickActions = [
		{ to: "/employees/new", label: "Nuevo usuario", icon: UserPlus },
		{ to: "/systems/new", label: "Nuevo sistema", icon: Boxes },
		{ to: "/roles/new", label: "Nuevo rol", icon: ShieldPlus },
	] as const;

	const quickLinks = [
		{
			to: "/sessions",
			label: "Sesiones",
			description:
				"Revisa y revoca las sesiones activas de todos los usuarios.",
			icon: MonitorSmartphone,
		},
		{
			to: "/profile",
			label: "Mi perfil",
			description: "Edita tus datos, contraseña y correo.",
			icon: CircleUser,
		},
		{
			to: "/docs",
			label: "Documentación",
			description: "Cómo integrar un nuevo backend con Elineas.",
			icon: BookOpen,
		},
	] as const;

	const firstName = (session.name ?? session.email ?? "").split(/\s+/)[0];

	return (
		<div className="space-y-8">
			<PageHeader
				title={firstName ? `Hola, ${firstName}` : "Consola de administración"}
				description="Gestiona usuarios, sistemas, roles y accesos del Identity Server."
			/>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">Resumen</h2>
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{stats.map((stat, index) => {
						const tint = STAT_TINTS[index % STAT_TINTS.length];
						return (
							<Link
								key={stat.to}
								to={stat.to}
								className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
							>
								{/* Marca de agua: el mismo ícono, grande y tenue, de fondo. */}
								<stat.icon
									className={cn(
										"pointer-events-none absolute -right-4 -bottom-4 size-24 opacity-[0.06] transition-transform duration-300 group-hover:scale-110",
										tint.text,
									)}
								/>
								<div className="relative flex items-center justify-between">
									<span
										className={cn(
											"flex size-10 items-center justify-center rounded-xl",
											tint.bg,
											tint.text,
										)}
									>
										<stat.icon className="size-5" />
									</span>
									<ArrowRight className="size-4 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
								</div>
								<div className="relative mt-4">
									{stat.query.isLoading ? (
										<Skeleton className="h-9 w-16 lg:h-12 lg:w-24" />
									) : (
										<p className="font-heading text-3xl font-semibold tabular-nums text-foreground lg:text-5xl">
											{stat.query.isError ? "—" : (stat.query.data ?? 0)}
										</p>
									)}
									<p className="text-sm text-muted-foreground">{stat.label}</p>
								</div>
							</Link>
						);
					})}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					Acciones rápidas
				</h2>
				<div className="flex flex-wrap gap-3">
					{quickActions.map((action) => (
						<Link
							key={action.to}
							to={action.to}
							className="group flex items-center gap-2.5 rounded-xl border border-border bg-card py-2.5 pr-4 pl-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
						>
							<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<action.icon className="size-4" />
							</span>
							{action.label}
						</Link>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					Accesos rápidos
				</h2>
				<div className="w-full grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{quickLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="w-full group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
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

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					Conectar un nuevo backend
				</h2>
				<div className="rounded-2xl border border-border bg-card p-5">
					<ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<li className="flex items-start gap-3">
							<Layers className="mt-0.5 size-4 shrink-0 text-primary" />
							<span className="text-sm text-muted-foreground">
								Registra el sistema y sus roles.
							</span>
						</li>
						<li className="flex items-start gap-3">
							<KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
							<span className="text-sm text-muted-foreground">
								Haz login contra /api/auth/sign-in y verifica el JWT con el JWKS
								del IS.
							</span>
						</li>
						<li className="flex items-start gap-3">
							<ShieldQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
							<span className="text-sm text-muted-foreground">
								Autoriza consultando /api/user-roles/me.
							</span>
						</li>
					</ol>
					<Link
						to="/docs"
						className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						Ver la guía completa con ejemplos por stack
						<ArrowRight className="size-3.5" />
					</Link>
				</div>
			</section>
		</div>
	);
}
