import { createFileRoute, Link } from "@tanstack/react-router";
import {
	KeyRound,
	Layers,
	LogOut,
	ShieldCheck,
	ShieldQuestion,
	UserCog,
} from "lucide-react";
import { CodeBlock } from "@/modules/admin/components/docs/code-block.tsx";
import { EndpointReference } from "@/modules/admin/components/docs/endpoint-reference.tsx";
import { FrameworkTabs } from "@/modules/admin/components/docs/framework-tabs.tsx";
import {
	rolesSnippet,
	verifySnippet,
} from "@/modules/admin/components/docs/integration-snippets.ts";
import { PageBreadcrumb } from "@/modules/common/components/partials/page-breadcrumb.tsx";
import { PageHeader } from "@/modules/common/components/partials/page-header.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/modules/common/components/ui/card.tsx";

export const Route = createFileRoute("/_authed/docs")({
	component: DocsPage,
});

const STEPS = [
	{
		icon: Layers,
		title: "1. Registra el sistema",
		description:
			"En Sistemas, crea uno para tu backend (nombre + slug). Ese slug identifica a tu sistema en cada login y en cada consulta de roles.",
		link: { to: "/systems", label: "Ir a Sistemas" },
	},
	{
		icon: UserCog,
		title: "2. Crea roles y asígnalos",
		description:
			"En Roles crea los roles de tu sistema (p. ej. admin, vendedor) y en Asignaciones dales esos roles a los usuarios que deban entrar. Sin al menos un rol en el sistema, el login de ese usuario se rechaza con 403.",
		link: { to: "/user-roles", label: "Ir a Asignaciones" },
	},
	{
		icon: KeyRound,
		title: "3. Implementa el login",
		description:
			'Tu frontend (o tu backend, por él) hace POST a /api/auth/sign-in con { email, password, systemSlug }. La respuesta trae { user, token } — el JWT corto — y el session token (largo plazo) viaja en la cabecera "set-auth-token".',
	},
	{
		icon: ShieldCheck,
		title: "4. Verifica el JWT en tu backend",
		description:
			"Con el JWKS público del IS, verifica la firma y expiración del JWT localmente (sin llamar al IS en cada petición). El JWT dura ~15 minutos; renuévalo con GET /api/auth/token usando el session token.",
	},
	{
		icon: ShieldQuestion,
		title: "5. Autoriza con los roles del usuario",
		description:
			"El JWT prueba identidad, no permisos. Para saber qué puede hacer el usuario en TU sistema, consulta GET /api/user-roles/me?systemSlug=… con el session token como Bearer.",
	},
	{
		icon: LogOut,
		title: "6. Cierra sesión",
		description:
			"POST /api/auth/sign-out con el session token revoca la sesión en el IS; limpia también tus propias cookies (session y jwt).",
	},
] as const;

function DocsPage() {
	return (
		<div className="space-y-8">
			<PageBreadcrumb items={[{ label: "Documentación" }]} />
			<PageHeader
				title="Documentación de integración"
				description="Cómo conectar un nuevo backend al flujo de autenticación y autorización de Elineas, con ejemplos por stack."
			/>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{STEPS.map((step) => (
					<Card key={step.title}>
						<CardHeader>
							<div className="flex items-center gap-3">
								<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<step.icon className="size-4" />
								</span>
								<CardTitle>{step.title}</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<CardDescription>{step.description}</CardDescription>
							{"link" in step && step.link && (
								<Link
									to={step.link.to}
									className="text-sm font-medium text-primary underline-offset-4 hover:underline"
								>
									{step.link.label} →
								</Link>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			<section className="space-y-3">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					Endpoints que necesitas
				</h2>
				<p className="text-sm text-muted-foreground">
					El resto de la API (empleados, sistemas, roles…) es exclusiva de
					esta consola administrativa; un backend cliente solo necesita estos.
				</p>
				<EndpointReference />
			</section>

			<section className="space-y-3">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					Verificar el JWT y consultar roles
				</h2>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<CodeBlock
						title={verifySnippet.title}
						code={verifySnippet.code}
						language={verifySnippet.language}
					/>
					<CodeBlock
						title={rolesSnippet.title}
						code={rolesSnippet.code}
						language={rolesSnippet.language}
					/>
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					Ejemplos de login por stack
				</h2>
				<p className="text-sm text-muted-foreground">
					Todos siguen el mismo patrón: el navegador llama a un backend
					propio (nunca directo al IS desde el cliente) que guarda el session
					token y el JWT en cookies httpOnly.
				</p>
				<FrameworkTabs />
			</section>

			<Card>
				<CardHeader>
					<CardTitle>Notas de seguridad</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
						<li>
							El <strong>session token</strong> es de larga duración (días):
							trátalo como una contraseña. Nunca lo expongas a JavaScript del
							navegador; guárdalo solo en una cookie httpOnly de tu backend.
						</li>
						<li>
							El <strong>JWT</strong> es de corta duración (~15 min) y se
							verifica sin llamar al IS: es el que puedes exponer al cliente
							si tu arquitectura lo necesita (p. ej. para llamadas directas
							desde el navegador a tu propia API).
						</li>
						<li>
							Agrega el origen de tu nuevo frontend a la lista de orígenes
							permitidos del Identity Server (variable{" "}
							<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
								ALLOWED_ORIGIN
							</code>
							) o las peticiones desde el navegador serán bloqueadas por CORS.
						</li>
						<li>
							El alta de usuarios no es autoservicio: solo un admin crea
							cuentas, desde Usuarios en esta consola.
						</li>
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}
