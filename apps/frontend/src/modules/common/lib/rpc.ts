import type {
	AuthRoutes,
	EmployeesRoutes,
	RequestLogsRoutes,
	RolesRoutes,
	SessionsAdminRoutes,
	SessionsRoutes,
	SystemsRoutes,
	UserRolesRoutes,
	UsersAdminRoutes,
	UsersRoutes,
} from "@elineas/auth-backend/rpc";
import { type ClientResponse, hc } from "hono/client";
import { readJson } from "#/modules/auth/lib/api.ts";
import { readSessionToken } from "#/modules/auth/lib/cookies.ts";
import { env } from "#/modules/auth/lib/env.ts";

// Clientes RPC tipados contra el grafo de rutas REAL del identity server.
//
// Los tipos los expone `@elineas/auth-backend/rpc` y son SOLO tipos: no arrastran
// nada del runtime del servidor (BD, Redis, better-auth) al bundle del panel.
// Por eso `@elineas/auth-backend` está en devDependencies y no en dependencies.
//
// Lo que esto sustituye: antes cada servicio llamaba a `isApi.get<T>("/api/...")`
// con la ruta como string y con `T` escrito a mano en `shared/types.ts`. Ni la
// ruta ni el tipo se comprobaban contra el servidor, así que un cambio en la
// API no rompía la compilación del panel: se descubría en producción. Ahora la
// ruta, el método, el cuerpo y la respuesta los deriva TypeScript del servidor.
//
// SOLO SERVIDOR: las cabeceras se construyen con `readSessionToken()`, que lee
// la cookie vía `@tanstack/react-start/server`. Estos clientes se usan desde
// las server functions, nunca desde el navegador (que no debe ver el token).

// Un cliente por grupo de rutas, en vez de uno solo sobre `AppType`, porque
// `hc<AppType>` pierde los hijos de un nodo que es a la vez hoja y rama —el
// caso de `/api/users/me`—. Ver el comentario en `apps/backend/src/rpc.ts`.
//
// El prefijo de montaje se declara aquí una única vez por grupo y debe coincidir
// con la tabla de `apps/backend/src/routes/index.ts`.
const options = {
	// Función y no objeto: se evalúa en CADA petición, ya dentro del contexto de
	// la server function. Como objeto se leería la cookie al importar el módulo,
	// fuera de contexto y con el token de quien arrancara el proceso.
	headers: (): Record<string, string> => {
		const token = readSessionToken();
		return token ? { Authorization: `Bearer ${token}` } : {};
	},
};

const base = env.AUTH_API_URL;

export const authRpc = hc<AuthRoutes>(`${base}/api/auth`, options);
export const usersRpc = hc<UsersRoutes>(`${base}/api/users`, options);
// Acciones administrativas sobre un usuario concreto. Sub-app aparte porque
// exigen rol admin, mientras /api/users solo exige sesión (ver el comentario en
// apps/backend/src/routes/users.routes.ts).
export const usersAdminRpc = hc<UsersAdminRoutes>(
	`${base}/api/users/admin`,
	options,
);
export const sessionsRpc = hc<SessionsRoutes>(`${base}/api/sessions`, options);
export const sessionsAdminRpc = hc<SessionsAdminRoutes>(
	`${base}/api/sessions/admin`,
	options,
);
export const employeesRpc = hc<EmployeesRoutes>(
	`${base}/api/employees`,
	options,
);
export const systemsRpc = hc<SystemsRoutes>(`${base}/api/systems`, options);
export const rolesRpc = hc<RolesRoutes>(`${base}/api/roles`, options);
export const userRolesRpc = hc<UserRolesRoutes>(
	`${base}/api/user-roles`,
	options,
);
export const requestLogsRpc = hc<RequestLogsRoutes>(
	`${base}/api/request-logs`,
	options,
);

// Una llamada RPC de Hono no devuelve un único tipo: devuelve la UNIÓN de una
// `ClientResponse` por cada status declarado en la ruta (200 | 400 | 401...).
// Este tipo se queda con el cuerpo del caso 2xx, que es el único que llega a
// devolverse: los demás los convierte `readJson` en un `AuthApiError`.
//
// Se distribuye sobre la unión porque `R` es un parámetro de tipo desnudo, así
// que basta con descartar las ramas de error para quedarse con la buena.
type SuccessBody<R> =
	R extends ClientResponse<infer T, infer S, "json">
		? S extends 200 | 201
			? T
			: never
		: never;

// Extrae el cuerpo de una respuesta RPC conservando el manejo de errores del
// panel: `readJson` lanza `AuthApiError` con status, code y retryAfter para
// cualquier respuesta no-2xx, que es de lo que dependen los formularios y el
// aviso de rate limit. Sin esto, `hc` devolvería la Response en crudo y cada
// llamada tendría que repetir la comprobación.
//
// El tipo de retorno lo infiere Hono del esquema de respuesta de la ruta, así
// que no hay ningún tipo escrito a mano en el camino. Las fechas llegan como
// string ISO porque es lo que sobrevive a JSON, y eso ya está reflejado en el
// tipo inferido.
export async function unwrap<R extends ClientResponse<unknown, number, "json">>(
	promise: Promise<R>,
): Promise<SuccessBody<R>> {
	const response = await promise;
	return (await readJson(response)) as SuccessBody<R>;
}
