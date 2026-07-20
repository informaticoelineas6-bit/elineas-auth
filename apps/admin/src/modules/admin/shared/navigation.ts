import {
	BookOpen,
	Boxes,
	MonitorSmartphone,
	ShieldCheck,
	UserCog,
	Users,
} from "lucide-react";

// Enlaces de la consola de administración. El `to` es literal (as const) para
// que TanStack Router valide cada ruta contra el route tree generado.
export const NAV_ITEMS = [
	{ to: "/employees", label: "Usuarios", icon: Users },
	{ to: "/systems", label: "Sistemas", icon: Boxes },
	{ to: "/roles", label: "Roles", icon: ShieldCheck },
	{ to: "/user-roles", label: "Asignaciones", icon: UserCog },
	{ to: "/sessions", label: "Sesiones", icon: MonitorSmartphone },
	{ to: "/docs", label: "Documentación", icon: BookOpen },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
