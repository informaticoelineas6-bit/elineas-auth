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
	google: {
		title: "Login con Google (redirect)",
		intro:
			"Alternativa (o complemento) al login con contraseña: tu app manda al usuario al IS, este lo lleva a Google y lo devuelve a tu app con un código de un solo uso que tu SERVIDOR canjea por la sesión. Funciona con correos @gmail.com y del dominio corporativo. Google nunca crea cuentas: el usuario debe existir ya en el IS (lo crea un admin) con ese mismo correo y tener al menos un rol.",
	},
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
			'Tu frontend (o tu backend, por él) hace POST a /api/auth/sign-in con { email, password, systemSlug? } (systemSlug es opcional: sin él, el token sirve en todos los sistemas donde el usuario tenga roles). La respuesta trae { user, token } — el JWT corto — y el session token (largo plazo) viaja en la cabecera "set-auth-token".',
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

// Markdown inline (**negrita** y `código`).
export const GOOGLE_FLOW_STEPS = [
	"**Configura el IS (una vez):** añade el origen de tu app a `GOOGLE_REDIRECT_ORIGINS` en el `.env` del backend del IS (https fuera de localhost). En Google Cloud no cambia nada: tu app nunca habla con Google, solo con el IS.",
	"**Inicio:** tu servidor genera un `code_verifier` aleatorio (PKCE) y un `state`, los guarda en una cookie httpOnly de vida corta y redirige el navegador a `GET /api/auth/google/start` con `redirect_to`, `code_challenge` (base64url del SHA-256 del verifier), `state` y, opcional, `systemSlug`.",
	"**Vuelta:** el IS devuelve al usuario a `redirect_to` con `?code=…&state=…` (o `?error=CODIGO`). Comprueba que el `state` coincide con el de tu cookie.",
	"**Canje (servidor a servidor):** `POST /api/auth/google/exchange` con `{ code, code_verifier }`. Responde lo mismo que `/sign-in` (`{ user, token, system, tkc }`) y el session token en la cabecera `set-auth-token`. El código dura 60 s y es de un solo uso.",
	"**Después** todo es igual que con contraseña: guarda el session token y el JWT en cookies httpOnly, verifica el JWT con el JWKS y consulta los roles.",
] as const;

export const GOOGLE_ERROR_CODES = [
	{
		code: "ACCOUNT_NOT_FOUND",
		meaning:
			"No existe un usuario con ese correo de Google. Un admin debe crearlo antes.",
	},
	{
		code: "NO_ROLES_IN_SYSTEM",
		meaning:
			"El usuario existe pero no tiene roles en el sistema indicado (o en ninguno).",
	},
	{
		code: "SYSTEM_NOT_FOUND",
		meaning: "El `systemSlug` no existe o está inactivo.",
	},
	{
		code: "GOOGLE_ACCESS_DENIED",
		meaning: "El usuario canceló o rechazó el acceso en Google.",
	},
	{
		code: "GOOGLE_AUTH_FAILED",
		meaning: "Cualquier otro fallo del inicio de sesión con Google.",
	},
	{
		code: "INVALID_REDIRECT",
		meaning:
			"(400 en /start) `redirect_to` no es un origen permitido: falta añadirlo a `GOOGLE_REDIRECT_ORIGINS`.",
	},
	{
		code: "INVALID_CODE",
		meaning:
			"(400 en /exchange) Código caducado, ya usado o `code_verifier` incorrecto.",
	},
	{
		code: "GOOGLE_NOT_CONFIGURED",
		meaning:
			"(503) El IS no tiene `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.",
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
			'Login con email + contraseña, y systemSlug opcional (sin él, token multi-sistema y system: null; se exige rol en el sistema indicado o, si no hay, en alguno). Devuelve { user, token, system } y el session token en la cabecera "set-auth-token".',
	},
	{
		method: "GET",
		path: "/api/auth/google/start",
		auth: "Público (navegador)",
		description:
			"Inicia el login con Google por redirect. Query: redirect_to, code_challenge (PKCE S256), state?, systemSlug?. Redirige a Google; ver la sección «Login con Google».",
	},
	{
		method: "POST",
		path: "/api/auth/google/exchange",
		auth: "Código + verifier",
		description:
			'Canjea el código de un solo uso (60 s) por la sesión: body { code, code_verifier }. Devuelve { user, token, system } y el session token en la cabecera "set-auth-token".',
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
	"En el login con Google, el `code_verifier` y el session token **nunca** deben llegar al JavaScript del navegador: si tu app es una SPA pura, necesita un pequeño backend que haga el canje. Valida siempre el `state` al volver.",
	"El avatar de la cuenta de Google se guarda como imagen del usuario (claim `image` del JWT) salvo que el usuario ya tenga una imagen propia.",
	"El alta de usuarios no es autoservicio: solo un admin crea cuentas, desde Usuarios en esta consola.",
];
