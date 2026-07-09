import { desc, eq } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { role } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import type {
  CreateRoleBodySchema,
  UpdateRoleBodySchema,
} from "@/openapi/business.schemas";

type CreateRoleInput = z.infer<typeof CreateRoleBodySchema>;
type UpdateRoleInput = z.infer<typeof UpdateRoleBodySchema>;

export async function listRoles(filters: { systemId?: string } = {}) {
  const where = filters.systemId ? eq(role.systemId, filters.systemId) : undefined;
  return db.select().from(role).where(where).orderBy(desc(role.createdAt));
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
