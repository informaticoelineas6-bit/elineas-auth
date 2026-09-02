import {
	KeyRound,
	Layers,
	LogOut,
	ShieldCheck,
	ShieldQuestion,
	UserCog,
} from "lucide-react";

// Contenido en prosa de la página de documentación de integración. Vive aquí
// (y no en el JSX) porque se consume dos veces: lo renderiza `/docs` y lo
// serializa `buildDocsMarkdown()` para el botón "Copiar para LLM". Editar un
// texto aquí lo actualiza en los dos sitios.

export const DOCS_TITLE = "Documentación de integración";

export const DOCS_DESCRIPTION =
	"Cómo conectar un nuevo backend al flujo de autenticación y autorización de Elineas, con ejemplos por stack.";

export const SECTIONS = {
	steps: { title: "Pasos de integración" },
	endpoints: {
		title: "Endpoints que necesitas",
		intro:
			"El resto de la API (empleados, sistemas, roles…) es exclusiva de esta consola administrativa; un backend cliente solo necesita estos.",
	},
	verify: { title: "Verificar el JWT y consultar roles" },
	examples: {
		title: "Ejemplos de login por stack",
		intro:
			"Todos siguen el mismo patrón: el navegador llama a un backend propio (nunca directo al IS desde el cliente) que guarda el session token y el JWT en cookies httpOnly.",
	},
	security: { title: "Notas de seguridad" },
} as const;

export const STEPS = [
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

export const ENDPOINT_METHODS = {
	GET: "secondary",
	POST: "default",
	DELETE: "destructive",
} as const;

export const ENDPOINTS: {
	method: keyof typeof ENDPOINT_METHODS;
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
		description:
			"Emite un JWT nuevo (el actual dura ~15 min) sin volver a pedir credenciales.",
	},
	{
		method: "GET",
		path: "/api/auth/jwks",
		auth: "Público",
		description:
			"JSON Web Key Set para verificar el JWT localmente (sin llamar al IS).",
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
		description:
			"Roles del usuario autenticado en un sistema concreto (para autorizar).",
	},
];

// Markdown inline (**negrita** y `código`): lo renderiza <InlineMarkdown> en la
// página y pasa tal cual al markdown que se copia para un LLM.
export const SECURITY_NOTES = [
	"El **session token** es de larga duración (días): trátalo como una contraseña. Nunca lo expongas a JavaScript del navegador; guárdalo solo en una cookie httpOnly de tu backend.",
	"El **JWT** es de corta duración (~15 min) y se verifica sin llamar al IS: es el que puedes exponer al cliente si tu arquitectura lo necesita (p. ej. para llamadas directas desde el navegador a tu propia API).",
	"Agrega el origen de tu nuevo frontend a la lista de orígenes permitidos del Identity Server (variable `ALLOWED_ORIGIN`) o las peticiones desde el navegador serán bloqueadas por CORS.",
	"El alta de usuarios no es autoservicio: solo un admin crea cuentas, desde Usuarios en esta consola.",
];
