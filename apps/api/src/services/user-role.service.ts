import { and, count, desc, eq } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { role, system, userRole } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import { toOffset, type PaginationInput } from "@/lib/pagination";
import type { CreateUserRoleBodySchema } from "@/openapi/business.schemas";

type CreateUserRoleInput = z.infer<typeof CreateUserRoleBodySchema>;

export async function listUserRoles(
  filters: { userId?: string; roleId?: string },
  pagination: PaginationInput,
) {
  const conditions = [
    filters.userId ? eq(userRole.userId, filters.userId) : undefined,
    filters.roleId ? eq(userRole.roleId, filters.roleId) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(userRole)
      .where(where)
      .orderBy(desc(userRole.createdAt))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db.select({ total: count() }).from(userRole).where(where),
  ]);
  return { rows, total };
}

export async function getUserRole(id: string) {
  const [row] = await db.select().from(userRole).where(eq(userRole.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Asignación no encontrada", "NOT_FOUND");
  return row;
}

export async function createUserRole(input: CreateUserRoleInput) {
  const [row] = await db.insert(userRole).values(input).returning();
  return row;
}

export async function deleteUserRole(id: string) {
  const [row] = await db
    .delete(userRole)
    .where(eq(userRole.id, id))
    .returning({ id: userRole.id });
  if (!row) throw new HttpError(404, "Asignación no encontrada", "NOT_FOUND");
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
