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
import type {
  AssignPermissionBodySchema,
  UpdatePermissionBodySchema,
} from "@backend/openapi/business.schemas.ts";
import type { z } from "@hono/zod-openapi";
import { and, asc, count, eq, inArray, or } from "drizzle-orm";

type AssignPermissionInput = z.infer<typeof AssignPermissionBodySchema>;
type UpdatePermissionInput = z.infer<typeof UpdatePermissionBodySchema>;

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

async function getPermission(id: string) {
  const [row] = await db
    .select()
    .from(permission)
    .where(eq(permission.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, "Permiso no encontrado", "NOT_FOUND");
  return row;
}

// Vista para el panel "permisos por sistema": un `system` con los permisos
// (distintos por resource+action) asignados a cualquiera de sus roles, y en
// qué roles concretos de ese sistema quedó cada uno. Incluye todos los
// sistemas (activos e inactivos) aunque no tengan permisos aún, para poder
// mostrar la card vacía y crear el primero desde ahí.
export async function listPermissionsBySystem() {
  const systems = await db.select().from(system).orderBy(asc(system.name));

  const rows = await db
    .select({
      systemId: role.systemId,
      roleId: role.id,
      roleName: role.name,
      permissionId: permission.id,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      createdAt: permission.createdAt,
    })
    .from(role)
    .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .innerJoin(permission, eq(permission.id, rolePermission.permissionId));

  const bySystem = new Map<
    string,
    Map<
      string,
      {
        id: string;
        resource: string;
        action: string;
        description: string | null;
        createdAt: Date;
        roles: Map<string, { id: string; name: string }>;
      }
    >
  >();
  for (const r of rows) {
    let perms = bySystem.get(r.systemId);
    if (!perms) {
      perms = new Map();
      bySystem.set(r.systemId, perms);
    }
    let perm = perms.get(r.permissionId);
    if (!perm) {
      perm = {
        id: r.permissionId,
        resource: r.resource,
        action: r.action,
        description: r.description,
        createdAt: r.createdAt,
        roles: new Map(),
      };
      perms.set(r.permissionId, perm);
    }
    perm.roles.set(r.roleId, { id: r.roleId, name: r.roleName });
  }

  return systems.map((s) => ({
    system: s,
    permissions: Array.from(bySystem.get(s.id)?.values() ?? [])
      .map((p) => ({ ...p, roles: Array.from(p.roles.values()) }))
      .sort(
        (a, b) =>
          a.resource.localeCompare(b.resource) ||
          a.action.localeCompare(b.action),
      ),
  }));
}

async function findOrCreatePermission(input: {
  resource: string;
  action: string;
  description?: string;
}) {
  const [existing] = await db
    .select()
    .from(permission)
    .where(
      and(
        eq(permission.resource, input.resource),
        eq(permission.action, input.action),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [row] = await db.insert(permission).values(input).returning();
  return row;
}

export async function assignPermissionToRole(
  roleId: string,
  permissionId: string,
) {
  await assertRoleExists(roleId);
  await getPermission(permissionId);
  await db
    .insert(rolePermission)
    .values({ roleId, permissionId })
    .onConflictDoNothing();
}

export async function unassignPermissionFromRole(
  roleId: string,
  permissionId: string,
) {
  await assertRoleExists(roleId);
  await getPermission(permissionId);
  await db
    .delete(rolePermission)
    .where(
      and(
        eq(rolePermission.roleId, roleId),
        eq(rolePermission.permissionId, permissionId),
      ),
    );
}

// Crea (o reutiliza) el permiso `resource:action` y lo asigna a `roleId`.
// Es la operación detrás de "crear un permiso para un sistema" en el panel:
// valida que el rol elegido pertenezca al sistema indicado antes de asignar.
export async function assignPermission(input: AssignPermissionInput) {
  const [roleRow] = await db
    .select({ systemId: role.systemId })
    .from(role)
    .where(eq(role.id, input.roleId))
    .limit(1);
  if (!roleRow) throw new HttpError(404, "Rol no encontrado", "NOT_FOUND");
  if (roleRow.systemId !== input.systemId) {
    throw new HttpError(
      400,
      "El rol no pertenece al sistema indicado",
      "BAD_REQUEST",
    );
  }

  const perm = await findOrCreatePermission({
    resource: input.resource,
    action: input.action,
    description: input.description,
  });
  await assignPermissionToRole(input.roleId, perm.id);
  return perm;
}

export async function updatePermission(
  id: string,
  input: UpdatePermissionInput,
) {
  if (Object.keys(input).length === 0) return getPermission(id);
  const [row] = await db
    .update(permission)
    .set(input)
    .where(eq(permission.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Permiso no encontrado", "NOT_FOUND");
  return row;
}

export async function deletePermission(id: string) {
  const [row] = await db
    .delete(permission)
    .where(eq(permission.id, id))
    .returning({ id: permission.id });
  if (!row) throw new HttpError(404, "Permiso no encontrado", "NOT_FOUND");
}

// Desasigna `permissionId` de todos los roles de `systemId` (el "quitar
// badge" del panel). El permiso sigue siendo un catálogo global: si tras
// esto ya no queda asignado a ningún rol de ningún sistema, se borra
// también la fila de `permission` para no dejar entradas huérfanas.
export async function removePermissionFromSystem(
  permissionId: string,
  systemId: string,
) {
  await getPermission(permissionId);

  const systemRoles = await db
    .select({ id: role.id })
    .from(role)
    .where(eq(role.systemId, systemId));
  const roleIds = systemRoles.map((r) => r.id);
  if (roleIds.length > 0) {
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.permissionId, permissionId),
          inArray(rolePermission.roleId, roleIds),
        ),
      );
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(rolePermission)
    .where(eq(rolePermission.permissionId, permissionId));

  let deleted = false;
  if (total === 0) {
    await db.delete(permission).where(eq(permission.id, permissionId));
    deleted = true;
  }
  return { deleted };
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
