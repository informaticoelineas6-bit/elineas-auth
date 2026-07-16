import { createServerFn } from "@tanstack/react-start";
import { env } from "#/modules/auth/lib/env.ts";
import { requireAuthMiddleware } from "#/modules/auth/middlewares/auth.ts";
import { listMyRoles } from "#/modules/user-roles/services/user-roles.ts";
import type { MyUserRole } from "#/modules/user-roles/shared/types.ts";

// Nombre del rol que concede acceso a la consola. Debe coincidir con
// ADMIN_ROLE_NAME del IS (por defecto "admin").
const ADMIN_ROLE_NAME = "admin";

export type AdminContext = {
	roles: MyUserRole[];
	isAdmin: boolean;
};

// Resuelve los roles del usuario en el sistema configurado (el JWT no los
// incluye, ver README del IS §7) y determina si es admin. El systemSlug se toma
// del entorno en el servidor —no se acepta del cliente— para que la comprobación
// de admin no dependa de un valor manipulable por el navegador.
export const resolveAdminContextFn = createServerFn({ method: "GET" })
	.middleware([requireAuthMiddleware])
	.handler(async (): Promise<AdminContext> => {
		const roles = await listMyRoles({ systemSlug: env.AUTH_SYSTEM_SLUG });
		const isAdmin = roles.some(
			(role) => role.name.toLowerCase() === ADMIN_ROLE_NAME,
		);
		return { roles, isAdmin };
	});
