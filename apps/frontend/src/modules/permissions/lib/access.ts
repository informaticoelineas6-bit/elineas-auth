import type { MyPermission } from "../shared/types.ts";

// Único punto de verdad para "¿puede este usuario ver/usar lo relacionado con
// `resource`?", reutilizado por la navegación (navigation.ts) y por cualquier
// página que enlace a un recurso ajeno al suyo (p. ej. el dashboard). `admin`
// siempre puede; `resource: undefined` marca algo admin-only (sin
// contrapartida en el catálogo de permisos, ver navigation.ts).
export function canAccessResource(
	resource: string | undefined,
	{ isAdmin, permissions }: { isAdmin: boolean; permissions: MyPermission[] },
): boolean {
	if (isAdmin) return true;
	if (resource === undefined) return false;
	return permissions.some((p) => p.resource === resource);
}
