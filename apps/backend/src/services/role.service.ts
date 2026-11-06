import { and, count, eq, getTableColumns, ilike, inArray, sql } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@backend/db/index.ts";
import { role, system } from "@backend/db/business-schema.ts";
import { HttpError } from "@backend/lib/http.ts";
import { escapeLike } from "@backend/lib/search.ts";
import { buildOrderBy, type SortInput } from "@backend/lib/sorting.ts";
import { toOffset, type PaginationInput } from "@backend/lib/pagination.ts";
import type {
  CreateRoleBodySchema,
  UpdateRoleBodySchema,
} from "@backend/openapi/business.schemas.ts";

type CreateRoleInput = z.infer<typeof CreateRoleBodySchema>;
type UpdateRoleInput = z.infer<typeof UpdateRoleBodySchema>;

export async function listRoles(
  // `systemIds` acota el listado al alcance del admin delegado (ver
  // system-admin.service.ts#scopeFilter); `undefined` = sin restricción.
  filters: { systemId?: string; systemIds?: string[]; search?: string },
  pagination: PaginationInput,
  sort?: SortInput<"name" | "system" | "description" | "createdAt">,
) {
  const conditions = [
    filters.systemId ? eq(role.systemId, filters.systemId) : undefined,
    filters.systemIds
      ? inArray(role.systemId, filters.systemIds)
      : undefined,
    filters.search ? ilike(role.name, `%${escapeLike(filters.search)}%`) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(getTableColumns(role))
      .from(role)
      .innerJoin(system, eq(role.systemId, system.id))
      .where(where)
      .orderBy(
        ...buildOrderBy(
          sort,
          {
            name: sql`lower(${role.name})`,
            system: sql`lower(${system.name})`,
            description: sql`lower(${role.description})`,
            createdAt: role.createdAt,
          },
          [role.createdAt, role.id],
        ),
      )
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
