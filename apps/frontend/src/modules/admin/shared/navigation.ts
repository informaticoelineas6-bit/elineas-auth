import {
	BookOpen,
	Boxes,
	MonitorSmartphone,
	ShieldCheck,
	UserCog,
	Users,
} from "lucide-react";
import { canAccessResource } from "#/modules/permissions/lib/access.ts";
import type { MyPermission } from "#/modules/permissions/shared/types.ts";

// Enlaces de la consola de administración. El `to` es literal (as const) para
// que TanStack Router valide cada ruta contra el route tree generado.
//
// `resource` es el recurso ("employees", "sessions", ...) cuyo permiso de
// lectura habilita el enlace para un rol NO admin (ver `isNavItemVisible`).
// Sin `resource`, el enlace es admin-only: hoy Systems, Roles, Asignaciones
// (/user-roles) y Documentación no tienen contrapartida en el catálogo de
// permisos. Systems/Roles/Asignaciones porque sus endpoints siguen exigiendo
// directamente el rol admin (ver el comentario en
// apps/backend/src/routes/roles.routes.ts sobre por qué: delegar su gestión
// sería delegar la propia llave del sistema de permisos). Documentación
// porque es la guía de integración de sistemas consumidores, así que es
// admin-only aunque no llame a la API (ver el guard en routes/_authed/docs.tsx).
export const NAV_ITEMS = [
	{ to: "/systems", label: "Sistemas", icon: Boxes, resource: undefined },
	{ to: "/roles", label: "Roles", icon: ShieldCheck, resource: undefined },
	{ to: "/employees", label: "Usuarios", icon: Users, resource: "employees" },
	{
		to: "/user-roles",
		label: "Asignaciones",
		icon: UserCog,
		resource: undefined,
	},
	{
		to: "/sessions",
		label: "Sesiones",
		icon: MonitorSmartphone,
		resource: "sessions",
	},
	{ to: "/docs", label: "Documentación", icon: BookOpen, resource: undefined },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

// Un enlace admin-only (`resource: undefined`) solo se ve siendo admin; uno
// sin permiso asociado (`resource: null`, ninguno hoy, reservado para un
// futuro enlace que deba verse siempre) siempre se ve; el resto se ve con el
// rol admin o con lectura sobre ese recurso.
export function isNavItemVisible(
	item: NavItem,
	context: { isAdmin: boolean; permissions: MyPermission[] },
): boolean {
	if (item.resource === null) return true;
	return canAccessResource(item.resource, context);
}

export function visibleNavItems(context: {
	isAdmin: boolean;
	permissions: MyPermission[];
}) {
	return NAV_ITEMS.filter((item) => isNavItemVisible(item, context));
}
