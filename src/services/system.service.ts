import { desc, eq } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { system } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import type {
  CreateSystemBodySchema,
  UpdateSystemBodySchema,
} from "@/openapi/business.schemas";

type CreateSystemInput = z.infer<typeof CreateSystemBodySchema>;
type UpdateSystemInput = z.infer<typeof UpdateSystemBodySchema>;

export async function listSystems() {
  return db.select().from(system).orderBy(desc(system.createdAt));
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
