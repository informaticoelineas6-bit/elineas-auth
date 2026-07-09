import { and, desc, eq } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { userRole } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import type { CreateUserRoleBodySchema } from "@/openapi/business.schemas";

type CreateUserRoleInput = z.infer<typeof CreateUserRoleBodySchema>;

export async function listUserRoles(
  filters: { userId?: string; roleId?: string } = {},
) {
  const conditions = [
    filters.userId ? eq(userRole.userId, filters.userId) : undefined,
    filters.roleId ? eq(userRole.roleId, filters.roleId) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;
  return db.select().from(userRole).where(where).orderBy(desc(userRole.createdAt));
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
