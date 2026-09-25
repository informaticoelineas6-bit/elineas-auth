import { env } from "@backend/config/env.ts";
import {
  permission,
  role,
  rolePermission,
  system,
  userRole,
} from "@backend/db/business-schema.ts";
import { db } from "@backend/db/index.ts";
import { HttpError } from "@backend/lib/http.ts";
import { and, asc, eq, or } from "drizzle-orm";

// Catálogo completo (no paginado: es una tabla de referencia pequeña y
// estable, pensada para poblar un selector en el panel de administración).
export async function listPermissions() {
  return db
    .select()
    .from(permission)
    .orderBy(asc(permission.resource), asc(permission.action));
}

// Permisos efectivos del usuario dentro de `systemSlug` (por defecto, el
// propio sistema `auth`, para no romper a quien ya llamaba a esto sin
// argumento). Cualquier sistema consumidor puede pedir los suyos: es la
// misma idea que `listMyRoles(userId, systemSlug)`, pero resolviendo también
// el `resource:action` de cada rol.
//
// Hay DOS comodines, ambos devuelven el catálogo completo:
//   - Rol admin en el sistema `auth` (env.ADMIN_SYSTEM_SLUG): superusuario
//     global del IS, ve/puede todo en cualquier sistema (igual que
//     requireAdmin).
//   - Rol admin dentro del propio `systemSlug` consultado: comodín LOCAL,
//     pensado para que un sistema nuevo no tenga que asignar manualmente
//     cada permiso a su propio rol admin.
// Fuera de esos dos casos, solo se devuelven los permisos explícitamente
// unidos vía role_permission a un rol de `systemSlug`.
export async function listMyPermissions(
  userId: string,
  systemSlug: string = env.ADMIN_SYSTEM_SLUG,
) {
  const rows = await db
    .select({
      systemSlug: system.slug,
      roleName: role.name,
      resource: permission.resource,
      action: permission.action,
    })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(system, eq(role.systemId, system.id))
    .leftJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .leftJoin(permission, eq(permission.id, rolePermission.permissionId))
    .where(
      and(
        eq(userRole.userId, userId),
        or(eq(system.slug, systemSlug), eq(system.slug, env.ADMIN_SYSTEM_SLUG)),
      ),
    );

  const isAdmin = rows.some(
    (r) =>
      r.roleName === env.ADMIN_ROLE_NAME &&
      (r.systemSlug === systemSlug || r.systemSlug === env.ADMIN_SYSTEM_SLUG),
  );
  if (isAdmin) {
    return (await listPermissions()).map(({ resource, action }) => ({
      resource,
      action,
    }));
  }

  const seen = new Set<string>();
  const result: Array<{ resource: string; action: string }> = [];
  for (const r of rows) {
    if (r.systemSlug !== systemSlug) continue;
    if (!r.resource || !r.action) continue;
    const key = `${r.resource}:${r.action}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ resource: r.resource, action: r.action });
  }
  return result;
}

async function assertRoleExists(roleId: string) {
  const [row] = await db
    .select({ id: role.id })
    .from(role)
    .where(eq(role.id, roleId))
    .limit(1);
  if (!row) throw new HttpError(404, "Rol no encontrado", "NOT_FOUND");
}

export async function listRolePermissions(roleId: string) {
  await assertRoleExists(roleId);

  return db
    .select({
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
    })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(eq(rolePermission.roleId, roleId))
    .orderBy(asc(permission.resource), asc(permission.action));
}

// Reemplaza el conjunto completo de permisos del rol por `permissionIds`
// ([] = quitarlos todos). Transaccional: o se aplica el conjunto nuevo
// entero, o no se toca nada; evita dejar el rol a medio actualizar si el
// insert falla a mitad de camino (p. ej. un id de permiso inexistente).
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[],
) {
  await assertRoleExists(roleId);

  await db.transaction(async (tx) => {
    await tx.delete(rolePermission).where(eq(rolePermission.roleId, roleId));
    if (permissionIds.length > 0) {
      await tx
        .insert(rolePermission)
        .values(
          permissionIds.map((permissionId) => ({ roleId, permissionId })),
        );
    }
  });

  return listRolePermissions(roleId);
}
