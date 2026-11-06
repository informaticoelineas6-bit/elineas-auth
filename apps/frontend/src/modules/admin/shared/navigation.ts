import {
	canAccessResource,
	canManageAnySystem,
	type ManagedSystem,
} from "@elineas/auth-contracts";
import {
	BookOpen,
	Boxes,
	Building2,
	Lock,
	MonitorSmartphone,
	ShieldCheck,
	UserCog,
	Users,
} from "lucide-react";
import type { MyPermission } from "#/modules/permissions/shared/types.ts";

// Enlaces de la consola de administración. El `to` es literal (as const) para
// que TanStack Router valide cada ruta contra el route tree generado.
//
// `resource` es el recurso ("employees", "sessions", ...) cuyo permiso de
// lectura habilita el enlace para un rol NO admin (ver `isNavItemVisible`).
// Sin `resource`, el enlace es admin-only: hoy Systems, Roles, Permisos,
// Asignaciones (/user-roles) y Documentación no tienen contrapartida en el
// catálogo de permisos. Systems/Roles/Permisos/Asignaciones porque sus
// endpoints siguen exigiendo directamente el rol admin (ver el comentario en
// apps/backend/src/routes/roles.routes.ts sobre por qué: delegar su gestión
// sería delegar la propia llave del sistema de permisos). Documentación
// porque es la guía de integración de sistemas consumidores, así que es
// admin-only aunque no llame a la API (ver el guard en routes/_authed/docs.tsx).
//
// `scope: "system-admin"` marca la administración DELEGADA por sistema: Roles,
// Permisos y Asignaciones los ve también quien administra algún sistema (rol
// admin dentro de ese sistema), y el IS acota cada lista a sus sistemas. El
// resto de enlaces admin-only (Sistemas, Documentación) siguen siendo solo
// del superadmin.
export const NAV_ITEMS = [
	{ to: "/systems", label: "Sistemas", icon: Boxes, resource: undefined },
	{
		to: "/roles",
		label: "Roles",
		icon: ShieldCheck,
		resource: undefined,
		scope: "system-admin",
	},
	{
		to: "/permissions",
		label: "Permisos",
		icon: Lock,
		resource: undefined,
		scope: "system-admin",
	},
	{ to: "/employees", label: "Usuarios", icon: Users, resource: "employees" },
	{
		to: "/departments",
		label: "Departamentos",
		icon: Building2,
		resource: "departments",
	},
	{
		to: "/system-users",
		label: "Usuarios del sistema",
		icon: Users,
		resource: undefined,
		scope: "system-users",
	},
	{
		to: "/user-roles",
		label: "Asignaciones",
		icon: UserCog,
		resource: undefined,
		scope: "system-admin",
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

type NavContext = {
	isAdmin: boolean;
	permissions: MyPermission[];
	managedSystems: ManagedSystem[];
};

// Un enlace admin-only (`resource: undefined`) solo se ve siendo admin, salvo
// los marcados `scope: "system-admin"`, que también ve quien administra algún
// sistema; uno sin permiso asociado (`resource: null`, ninguno hoy, reservado
// para un futuro enlace que deba verse siempre) siempre se ve; el resto se ve
// con el rol admin o con lectura sobre ese recurso.
export function isNavItemVisible(item: NavItem, context: NavContext): boolean {
	if (item.resource === null) return true;
	if ("scope" in item && item.scope === "system-admin") {
		return canManageAnySystem(context);
	}
	// "Usuarios del sistema": para quien administra sistemas sin ser superadmin
	// (el superadmin ya tiene "Usuarios", que lista a todos).
	if ("scope" in item && item.scope === "system-users") {
		return !context.isAdmin && context.managedSystems.length > 0;
	}
	return canAccessResource(item.resource, context);
}

export function visibleNavItems(context: NavContext) {
	return NAV_ITEMS.filter((item) => isNavItemVisible(item, context));
}
