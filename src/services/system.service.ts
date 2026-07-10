import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { system } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import { toOffset, type PaginationInput } from "@/lib/pagination";
import type {
  CreateSystemBodySchema,
  UpdateSystemBodySchema,
} from "@/openapi/business.schemas";

type CreateSystemInput = z.infer<typeof CreateSystemBodySchema>;
type UpdateSystemInput = z.infer<typeof UpdateSystemBodySchema>;

export async function listSystems(
  filters: { active?: boolean; search?: string },
  pagination: PaginationInput,
) {
  const conditions = [
    filters.active === undefined ? undefined : eq(system.active, filters.active),
    filters.search
      ? or(
          ilike(system.name, `%${filters.search}%`),
          ilike(system.slug, `%${filters.search}%`),
        )
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(system)
      .where(where)
      .orderBy(desc(system.createdAt))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db.select({ total: count() }).from(system).where(where),
  ]);
  return { rows, total };
}

export async function getSystem(id: string) {
  const [row] = await db.select().from(system).where(eq(system.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Sistema no encontrado", "NOT_FOUND");
  return row;
}

export async function createSystem(input: CreateSystemInput) {
  const [row] = await db.insert(system).values(input).returning();
  return row;
}

export async function updateSystem(id: string, input: UpdateSystemInput) {
  if (Object.keys(input).length === 0) return getSystem(id);
  const [row] = await db
    .update(system)
    .set(input)
    .where(eq(system.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Sistema no encontrado", "NOT_FOUND");
  return row;
}

export async function deleteSystem(id: string) {
  const [row] = await db
    .delete(system)
    .where(eq(system.id, id))
    .returning({ id: system.id });
  if (!row) throw new HttpError(404, "Sistema no encontrado", "NOT_FOUND");
}
