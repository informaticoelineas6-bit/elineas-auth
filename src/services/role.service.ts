import { and, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { role } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import { escapeLike } from "@/lib/search";
import { toOffset, type PaginationInput } from "@/lib/pagination";
import type {
  CreateRoleBodySchema,
  UpdateRoleBodySchema,
} from "@/openapi/business.schemas";

type CreateRoleInput = z.infer<typeof CreateRoleBodySchema>;
type UpdateRoleInput = z.infer<typeof UpdateRoleBodySchema>;

export async function listRoles(
  filters: { systemId?: string; search?: string },
  pagination: PaginationInput,
) {
  const conditions = [
    filters.systemId ? eq(role.systemId, filters.systemId) : undefined,
    filters.search ? ilike(role.name, `%${escapeLike(filters.search)}%`) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(role)
      .where(where)
      .orderBy(desc(role.createdAt))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db.select({ total: count() }).from(role).where(where),
  ]);
  return { rows, total };
}

export async function getRole(id: string) {
  const [row] = await db.select().from(role).where(eq(role.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Rol no encontrado", "NOT_FOUND");
  return row;
}

export async function createRole(input: CreateRoleInput) {
  const [row] = await db.insert(role).values(input).returning();
  return row;
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  if (Object.keys(input).length === 0) return getRole(id);
  const [row] = await db.update(role).set(input).where(eq(role.id, id)).returning();
  if (!row) throw new HttpError(404, "Rol no encontrado", "NOT_FOUND");
  return row;
}

export async function deleteRole(id: string) {
  const [row] = await db
    .delete(role)
    .where(eq(role.id, id))
    .returning({ id: role.id });
  if (!row) throw new HttpError(404, "Rol no encontrado", "NOT_FOUND");
}
