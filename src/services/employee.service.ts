import { desc, eq } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { employee } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import type {
  CreateEmployeeBodySchema,
  UpdateEmployeeBodySchema,
} from "@/openapi/business.schemas";

type CreateEmployeeInput = z.infer<typeof CreateEmployeeBodySchema>;
type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeBodySchema>;

export async function listEmployees(filters: { active?: boolean } = {}) {
  const where =
    filters.active === undefined ? undefined : eq(employee.active, filters.active);
  return db
    .select()
    .from(employee)
    .where(where)
    .orderBy(desc(employee.createdAt));
}

export async function getEmployee(id: string) {
  const [row] = await db.select().from(employee).where(eq(employee.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Empleado no encontrado", "NOT_FOUND");
  return row;
}

export async function createEmployee(input: CreateEmployeeInput) {
  const [row] = await db.insert(employee).values(input).returning();
  return row;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  if (Object.keys(input).length === 0) return getEmployee(id);
  const [row] = await db
    .update(employee)
    .set(input)
    .where(eq(employee.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Empleado no encontrado", "NOT_FOUND");
  return row;
}

export async function deleteEmployee(id: string) {
  const [row] = await db
    .delete(employee)
    .where(eq(employee.id, id))
    .returning({ id: employee.id });
  if (!row) throw new HttpError(404, "Empleado no encontrado", "NOT_FOUND");
}
