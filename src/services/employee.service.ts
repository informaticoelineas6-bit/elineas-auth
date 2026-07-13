import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { employee } from "@/db/business-schema";
import { HttpError } from "@/lib/http";
import { escapeLike } from "@/lib/search";
import { toOffset, type PaginationInput } from "@/lib/pagination";
import type {
  CreateEmployeeBodySchema,
  UpdateEmployeeBodySchema,
} from "@/openapi/business.schemas";

type CreateEmployeeInput = z.infer<typeof CreateEmployeeBodySchema>;
type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeBodySchema>;

export async function listEmployees(
  filters: { active?: boolean; search?: string },
  pagination: PaginationInput,
) {
  const conditions = [
    filters.active === undefined ? undefined : eq(employee.active, filters.active),
    filters.search
      ? (() => {
          const term = `%${escapeLike(filters.search)}%`;
          return or(
            ilike(employee.name, term),
            ilike(employee.lastName, term),
            ilike(employee.ci, term),
          );
        })()
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  // Filas de la página y total (para los metadatos) en paralelo: comparten el
  // mismo `where` para que el total refleje los filtros aplicados.
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(employee)
      .where(where)
      .orderBy(desc(employee.createdAt))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db.select({ total: count() }).from(employee).where(where),
  ]);
  return { rows, total };
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
