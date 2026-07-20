import { Badge } from "@/modules/common/components/ui/badge.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/modules/common/components/ui/table.tsx";

const METHOD_VARIANT = {
	GET: "secondary",
	POST: "default",
	DELETE: "destructive",
} as const;

const ENDPOINTS: {
	method: keyof typeof METHOD_VARIANT;
	path: string;
	auth: string;
	description: string;
}[] = [
	{
		method: "POST",
		path: "/api/auth/sign-in",
		auth: "—",
		description:
			'Login con email + contraseña + systemSlug. Devuelve { user, token, system } y el session token en la cabecera "set-auth-token".',
	},
	{
		method: "GET",
		path: "/api/auth/token",
		auth: "Session token",
		description: "Emite un JWT nuevo (el actual dura ~15 min) sin volver a pedir credenciales.",
	},
	{
		method: "GET",
		path: "/api/auth/jwks",
		auth: "Público",
		description: "JSON Web Key Set para verificar el JWT localmente (sin llamar al IS).",
	},
	{
		method: "POST",
		path: "/api/auth/sign-out",
		auth: "Session token",
		description: "Revoca la sesión actual.",
	},
	{
		method: "GET",
		path: "/api/user-roles/me?systemSlug=…",
		auth: "Session token",
		description: "Roles del usuario autenticado en un sistema concreto (para autorizar).",
	},
];

// Tabla de referencia rápida de los endpoints que necesita un backend nuevo
// para integrarse (login, verificación y autorización). El resto de la API
// (empleados, sistemas, roles…) es exclusiva de esta consola administrativa.
export function EndpointReference() {
	return (
		<div className="rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Método</TableHead>
						<TableHead>Ruta</TableHead>
						<TableHead>Autenticación</TableHead>
						<TableHead>Qué hace</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{ENDPOINTS.map((endpoint) => (
						<TableRow key={endpoint.path}>
							<TableCell>
								<Badge variant={METHOD_VARIANT[endpoint.method]}>
									{endpoint.method}
								</Badge>
							</TableCell>
							<TableCell className="font-mono text-xs whitespace-normal">
								{endpoint.path}
							</TableCell>
							<TableCell className="whitespace-normal text-muted-foreground">
								{endpoint.auth}
							</TableCell>
							<TableCell className="whitespace-normal text-muted-foreground">
								{endpoint.description}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
