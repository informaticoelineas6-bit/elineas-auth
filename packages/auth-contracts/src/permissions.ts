// Permiso efectivo tal cual lo devuelve el IS en GET /api/permissions/me
// (ver `apps/backend/src/services/permission.service.ts`). Sin dependencias
// de runtime a propósito: cualquier frontend cliente del IS (no solo el
// panel de administración) importa este tipo y las funciones de más abajo
// desde `@elineas/auth-contracts`, en vez de reimplementar su propia
// política de acceso.
export type MyPermission = {
  resource: string;
  action: string;
};

// Único punto de verdad para "¿puede este usuario ver/usar lo relacionado con
// `resource`?". `isAdmin` siempre puede; `resource: undefined` marca algo
// admin-only (sin contrapartida en el catálogo de permisos).
export function canAccessResource(
  resource: string | undefined,
  { isAdmin, permissions }: { isAdmin: boolean; permissions: MyPermission[] },
): boolean {
  if (isAdmin) return true;
  if (resource === undefined) return false;
  return permissions.some((p) => p.resource === resource);
}

// Igual que `canAccessResource`, pero para gatear un BOTÓN o ENLACE concreto
// que dispara una acción puntual (crear/editar/borrar), no una sección entera:
// exige el permiso exacto "resource:action" (el mismo que valida el endpoint
// del IS con requirePermission), no solo cualquier permiso sobre el recurso.
// Sin esto, un rol con employees:read pero sin employees:delete vería el botón
// de borrar y solo descubriría que no puede al recibir el 403.
export function hasPermission(
  resource: string,
  action: string,
  { isAdmin, permissions }: { isAdmin: boolean; permissions: MyPermission[] },
): boolean {
  if (isAdmin) return true;
  return permissions.some(
    (p) => p.resource === resource && p.action === action,
  );
}
