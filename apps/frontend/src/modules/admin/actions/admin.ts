import { createServerFn } from "@tanstack/react-start";
import { env } from "#/modules/auth/lib/env.ts";
import { authMiddleware } from "#/modules/auth/middlewares/auth.ts";
import type { AuthSession } from "#/modules/auth/shared/types.ts";
import { listMyRoles } from "#/modules/user-roles/services/user-roles.ts";
import type { MyUserRole } from "#/modules/user-roles/shared/types.ts";

// Nombre del rol que concede acceso a la consola. Debe coincidir con
// ADMIN_ROLE_NAME del IS (por defecto "admin").
const ADMIN_ROLE_NAME = "admin";

// Contexto que necesita el guard de _authed en una sola respuesta: si no hay
// sesión, `session: null` (el guard redirige al login); si la hay, además los
// roles del usuario y si es admin. Unión discriminada por `session`.
export type AuthedContext =
	| { session: null }
	| { session: AuthSession; roles: MyUserRole[]; isAdmin: boolean };

// Resuelve sesión + roles + isAdmin en UNA sola server fn (un único round-trip
// navegador↔servidor y una única verificación/refresh de JWT). Antes eran dos
// llamadas en serie (getSessionFn + resolveAdminContextFn), y como la segunda
// usaba requireAuthMiddleware, `getAuthSession` corría dos veces por navegación.
// Los roles no vienen en el JWT (ver README del IS §7); el systemSlug se toma
// del entorno en el servidor —no del cliente— para que la comprobación de admin
// no dependa de un valor manipulable por el navegador.
export const resolveAuthedContextFn = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }): Promise<AuthedContext> => {
		if (!context.session) return { session: null };
		const roles = await listMyRoles({ systemSlug: env.AUTH_SYSTEM_SLUG });
		const isAdmin = roles.some(
			(role) => role.name.toLowerCase() === ADMIN_ROLE_NAME,
		);
		return { session: context.session, roles, isAdmin };
	});
