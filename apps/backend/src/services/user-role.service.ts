import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@backend/db/index.ts";
import { user } from "@backend/db/auth-schema.ts";
import { role, system, userRole } from "@backend/db/business-schema.ts";
import { env } from "@backend/config/env.ts";
import { HttpError } from "@backend/lib/http.ts";
import { buildOrderBy, type SortInput } from "@backend/lib/sorting.ts";
import { toOffset, type PaginationInput } from "@backend/lib/pagination.ts";
import type { CreateUserRoleBodySchema } from "@backend/openapi/business.schemas.ts";

type CreateUserRoleInput = z.infer<typeof CreateUserRoleBodySchema>;

export async function listUserRoles(
  // `systemIds` acota al alcance del admin delegado; `undefined` = sin límite.
  filters: {
    userId?: string;
    roleId?: string;
    systemId?: string;
    systemIds?: string[];
  },
  pagination: PaginationInput,
  sort?: SortInput<"user" | "role" | "system" | "createdAt">,
) {
  const conditions = [
    filters.userId ? eq(userRole.userId, filters.userId) : undefined,
    filters.roleId ? eq(userRole.roleId, filters.roleId) : undefined,
    filters.systemId ? eq(role.systemId, filters.systemId) : undefined,
    filters.systemIds ? inArray(role.systemId, filters.systemIds) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  // El filtro por sistema requiere unir con `role` (userRole no tiene systemId
  // propio); se aplica el mismo join incondicionalmente para mantener una sola
  // consulta y evitar duplicar la lógica de `where` entre ambos casos.
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: userRole.id,
        userId: userRole.userId,
        roleId: userRole.roleId,
        createdAt: userRole.createdAt,
        user: { name: user.name, email: user.email },
        role: { name: role.name },
        system: { id: system.id, name: system.name, slug: system.slug },
      })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .innerJoin(system, eq(role.systemId, system.id))
      .leftJoin(user, eq(userRole.userId, user.id))
      .where(where)
      .orderBy(
        ...buildOrderBy(
          sort,
          {
            user: sql`lower(${user.name})`,
            role: sql`lower(${role.name})`,
            system: sql`lower(${system.name})`,
            createdAt: userRole.createdAt,
          },
          [userRole.createdAt, userRole.id],
        ),
      )
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db
      .select({ total: count() })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .where(where),
  ]);
  return { rows, total };
}

export async function getUserRole(id: string) {
  const [row] = await db.select().from(userRole).where(eq(userRole.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Asignación no encontrada", "NOT_FOUND");
  return row;
}

export async function createUserRole(input: CreateUserRoleInput) {
  const [existing] = await db
    .select({ id: userRole.id })
    .from(userRole)
    .where(
      and(eq(userRole.userId, input.userId), eq(userRole.roleId, input.roleId)),
    )
    .limit(1);
  if (existing) {
    throw new HttpError(
      409,
      "Este usuario ya tiene ese rol asignado",
      "CONFLICT",
    );
  }
  const [row] = await db.insert(userRole).values(input).returning();
  return row;
}

// Rol y sistema de una asignación (404 si no existe). Las rutas delegadas lo
// usan para comprobar el alcance antes de crear/borrar.
export async function getUserRoleScope(id: string) {
  const [row] = await db
    .select({
      userId: userRole.userId,
      roleId: userRole.roleId,
      roleName: role.name,
      systemId: role.systemId,
    })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .where(eq(userRole.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, "Asignación no encontrada", "NOT_FOUND");
  return row;
}

// Rol (con su sistema) por id, 404 si no existe.
export async function getRoleScope(roleId: string) {
  const [row] = await db
    .select({ id: role.id, name: role.name, systemId: role.systemId })
    .from(role)
    .where(eq(role.id, roleId))
    .limit(1);
  if (!row) throw new HttpError(404, "Rol no encontrado", "NOT_FOUND");
  return row;
}

// Borra la asignación. Si es la del rol admin de un sistema, impide dejarlo
// sin ningún admin (409 LAST_SYSTEM_ADMIN) — salvo el sistema `auth`, que ya
// tiene su propia salvaguarda en el panel y donde el superadmin puede
// reorganizar. La comprobación va en transacción con FOR UPDATE sobre las
// asignaciones del rol admin para que dos revocaciones simultáneas no dejen
// el sistema sin admin.
export async function deleteUserRole(id: string) {
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        roleId: userRole.roleId,
        roleName: role.name,
        systemSlug: system.slug,
      })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .innerJoin(system, eq(role.systemId, system.id))
      .where(eq(userRole.id, id))
      .limit(1);
    if (!target) {
      throw new HttpError(404, "Asignación no encontrada", "NOT_FOUND");
    }

    if (
      target.roleName === env.ADMIN_ROLE_NAME &&
      target.systemSlug !== env.ADMIN_SYSTEM_SLUG
    ) {
      const admins = await tx
        .select({ id: userRole.id })
        .from(userRole)
        .where(eq(userRole.roleId, target.roleId))
        .for("update");
      if (admins.length <= 1) {
        throw new HttpError(
          409,
          "No se puede quitar el último administrador del sistema",
          "LAST_SYSTEM_ADMIN",
        );
      }
    }

    await tx.delete(userRole).where(eq(userRole.id, id));
  });
}

// ¿Tiene el usuario al menos un rol dentro del sistema indicado? Se usa en el
// login para rechazar el acceso a un sistema en el que el usuario no tiene
// ningún rol asignado (autenticación válida pero sin autorización en destino).
export async function userHasRoleInSystem(
  userId: string,
  systemId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userRole.id })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .where(and(eq(userRole.userId, userId), eq(role.systemId, systemId)))
    .limit(1);
  return Boolean(row);
}

// ¿Tiene el usuario al menos un rol en CUALQUIER sistema activo? Es el requisito
// del login sin `systemSlug` (token multi-sistema): cada sistema decide después
// por sí mismo si el usuario tiene rol en él.
export async function userHasRoleInAnySystem(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userRole.id })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(system, eq(role.systemId, system.id))
    .where(and(eq(userRole.userId, userId), eq(system.active, true)))
    .limit(1);
  return Boolean(row);
}

// Roles del propio usuario autenticado, con el sistema al que pertenece cada
// uno. A diferencia de listUserRoles, no requiere admin: solo puede filtrar
// por el userId de quien llama.
export async function listMyRoles(userId: string, systemSlug?: string) {
  const conditions = [
    eq(userRole.userId, userId),
    systemSlug ? eq(system.slug, systemSlug) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  return db
    .select({
      id: role.id,
      name: role.name,
      description: role.description,
      system: { id: system.id, slug: system.slug, name: system.name },
    })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(system, eq(role.systemId, system.id))
    .where(and(...conditions));
}
