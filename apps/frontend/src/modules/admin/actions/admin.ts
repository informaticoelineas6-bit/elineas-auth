import { createServerFn } from "@tanstack/react-start";
import { AuthApiError } from "#/modules/auth/lib/api.ts";
import { clearAuthCookies } from "#/modules/auth/lib/cookies.ts";
import { env } from "#/modules/auth/lib/env.ts";
import { authMiddleware } from "#/modules/auth/middlewares/auth.ts";
import type { AuthSession } from "#/modules/auth/shared/types.ts";
import { listMyPermissions } from "#/modules/permissions/services/permissions.ts";
import type { MyPermission } from "#/modules/permissions/shared/types.ts";
import { listMyRoles } from "#/modules/user-roles/services/user-roles.ts";
import type { MyUserRole } from "#/modules/user-roles/shared/types.ts";

// Nombre del rol que concede acceso TOTAL a la consola. Debe coincidir con
// ADMIN_ROLE_NAME del IS (por defecto "admin"). Un rol delegado (rrhh,
// soporte, ...) entra también, pero solo ve las secciones para las que tenga
// permiso — ver `permissions` más abajo y modules/admin/shared/navigation.ts.
const ADMIN_ROLE_NAME = "admin";

// Contexto que necesita el guard de _authed en una sola respuesta: si no hay
// sesión, `session: null` (el guard redirige al login); si la hay, además los
// roles y permisos efectivos del usuario. Unión discriminada por `session`.
export type AuthedContext =
	| { session: null }
	| {
			session: AuthSession;
			roles: MyUserRole[];
			permissions: MyPermission[];
			isAdmin: boolean;
	  };

// Resuelve sesión + roles + permisos en UNA sola server fn (un único round-trip
// navegador↔servidor y una única verificación/refresh de JWT). Antes eran dos
// llamadas en serie (getSessionFn + resolveAdminContextFn), y como la segunda
// usaba requireAuthMiddleware, `getAuthSession` corría dos veces por navegación.
// Los roles no vienen en el JWT (ver README del IS §7); el systemSlug se toma
// del entorno en el servidor —no del cliente— para que la comprobación de admin
// no dependa de un valor manipulable por el navegador.
//
// `permissions` ya viene resuelto por el IS (GET /api/permissions/me): si el
// usuario es admin, es el catálogo completo (comodín); si no, la unión de los
// permisos de sus roles. El panel nunca decide por su cuenta qué puede hacer
// un rol, solo refleja lo que el propio backend ya le permitiría.
export const resolveAuthedContextFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }): Promise<AuthedContext> => {
		if (!context.session) return { session: null };

		let roles: MyUserRole[];
		let permissions: MyPermission[];
		try {
			[roles, permissions] = await Promise.all([
				listMyRoles({ systemSlug: env.AUTH_SYSTEM_SLUG }),
				listMyPermissions(),
			]);
		} catch (error) {
			// `context.session` viene del JWT cacheado (ver getAuthSession en
			// modules/auth/lib/session.ts), verificado localmente sin llamar al
			// IS: puede seguir pareciendo válido un rato después de que la sesión
			// larga que usan estas dos llamadas (el token de sesión, vía Bearer)
			// ya haya muerto de verdad — p. ej. al volver a una pestaña dejada de
			// fondo un buen rato, o si esa sesión se revocó (otro login del mismo
			// usuario en el mismo sistema revoca la anterior, ver signInFn). Sin
			// este catch, ese 401 se propagaba sin capturar y el guard de _authed
			// lo mostraba como "No se pudieron cargar tus permisos" (AdminRolesError)
			// en vez de la redirección normal al login — confuso, porque no es un
			// problema de permisos sino de sesión caducada. Se trata igual que
			// "sin sesión": el resto de errores (5xx, red) sí siguen reventando,
			// para que AdminRolesError ofrezca reintentar.
			//
			// clearAuthCookies() es imprescindible aquí, no cosmético: sin ella, la
			// cookie is_jwt (todavía válida, es la que hace parecer viva la sesión)
			// sigue puesta, así que "/" (que solo mira esa cookie, ver getSessionFn)
			// cree que SÍ hay sesión y redirige de vuelta a /dashboard — que vuelve
			// a caer aquí. Bucle infinito de redirects entre "/" y "/dashboard".
			// Limpiando las cookies, "/" ve correctamente que no hay sesión.
			if (error instanceof AuthApiError && error.status === 401) {
				clearAuthCookies();
				return { session: null };
			}
			throw error;
		}

		const isAdmin = roles.some(
			(role) => role.name.toLowerCase() === ADMIN_ROLE_NAME,
		);
		return { session: context.session, roles, permissions, isAdmin };
	});
