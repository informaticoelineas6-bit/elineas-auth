import { and, asc, count, eq, ilike, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@backend/db/index.ts";
import { department, employee, employeeDepartment } from "@backend/db/business-schema.ts";
import { user } from "@backend/db/auth-schema.ts";
import { queryIsAdmin } from "@backend/middleware/admin.ts";
import { HttpError } from "@backend/lib/http.ts";
import { escapeLike } from "@backend/lib/search.ts";
import { buildOrderBy, type SortInput } from "@backend/lib/sorting.ts";
import { toOffset, type PaginationInput } from "@backend/lib/pagination.ts";
import type {
  BulkCreateDepartmentsBodySchema,
  CreateDepartmentBodySchema,
  UpdateDepartmentBodySchema,
} from "@backend/openapi/business.schemas.ts";

type CreateDepartmentInput = z.infer<typeof CreateDepartmentBodySchema>;
type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentBodySchema>;
type BulkCreateInput = z.infer<typeof BulkCreateDepartmentsBodySchema>;

// --- Lógica pura (testeable sin BD) -----------------------------------------

const nameKey = (name: string) => name.trim().toLowerCase();

// Alta múltiple: quita repetidos dentro de la petición y los que ya existen
// (sin distinguir mayúsculas ni espacios en los extremos). Conserva el primero.
export function planBulkCreate<T extends { name: string }>(
  requested: T[],
  existingNames: string[],
) {
  const seen = new Set<string>();
  const unique = requested.filter((d) => {
    const key = nameKey(d.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const existingKeys = new Set(existingNames.map(nameKey));
  return {
    lookupKeys: [...seen],
    toInsert: unique.filter((d) => !existingKeys.has(nameKey(d.name))),
  };
}

// Nombres pedidos que NO se crearon (repetidos, existentes o perdidos en carrera).
export function skippedNames(requestedNames: string[], createdNames: string[]) {
  const created = new Set(createdNames);
  return requestedNames.filter((n) => !created.has(n));
}

// Jefe por defecto: un valor explícito siempre manda; si no, lo es quien es admin.
export function resolveIsHead(explicit: boolean | undefined, isAdmin: boolean) {
  return explicit ?? isAdmin;
}

// Separa los usuarios a agregar de los que ya eran miembros del departamento.
export function partitionNewMembers(
  userIds: string[],
  employeeByUser: Map<string, string>,
  memberEmployeeIds: Set<string>,
) {
  const added: string[] = [];
  const skipped: string[] = [];
  for (const userId of userIds) {
    const employeeId = employeeByUser.get(userId);
    if (employeeId && memberEmployeeIds.has(employeeId)) skipped.push(userId);
    else added.push(userId);
  }
  return { added, skipped };
}

export async function listDepartments(
  filters: { active?: boolean; search?: string },
  pagination: PaginationInput,
  sort?: SortInput<"name" | "description" | "active" | "members" | "createdAt">,
) {
  const conditions = [
    filters.active === undefined ? undefined : eq(department.active, filters.active),
    filters.search
      ? ilike(department.name, `%${escapeLike(filters.search)}%`)
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const memberCount = count(employeeDepartment.id);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: department.id,
        name: department.name,
        description: department.description,
        active: department.active,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
        memberCount,
      })
      .from(department)
      .leftJoin(employeeDepartment, eq(employeeDepartment.departmentId, department.id))
      .where(where)
      .groupBy(department.id)
      .orderBy(
        ...buildOrderBy(
          sort,
          {
            name: sql`lower(${department.name})`,
            description: sql`lower(${department.description})`,
            active: department.active,
            members: memberCount,
            createdAt: department.createdAt,
          },
          [department.createdAt, department.id],
        ),
      )
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db.select({ total: count() }).from(department).where(where),
  ]);
  return { rows, total };
}

export async function getDepartment(id: string) {
  const [row] = await db.select().from(department).where(eq(department.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Departamento no encontrado", "NOT_FOUND");
  return row;
}

export async function createDepartment(input: CreateDepartmentInput) {
  const [row] = await db.insert(department).values(input).returning();
  return row;
}

// Alta múltiple tolerante: los nombres repetidos dentro de la petición o que ya
// existen (sin distinguir mayúsculas) se omiten y se devuelven en `skipped`,
// en vez de abortar todo el lote por un duplicado.
export async function bulkCreateDepartments({ departments }: BulkCreateInput) {
  const requestedKeys = [...new Set(departments.map((d) => nameKey(d.name)))];
  const existing = await db
    .select({ name: department.name })
    .from(department)
    .where(inArray(sql`lower(${department.name})`, requestedKeys));
  const { toInsert } = planBulkCreate(
    departments,
    existing.map((e) => e.name),
  );

  // `onConflictDoNothing` cubre la carrera con otra petición concurrente.
  const created = toInsert.length
    ? await db.insert(department).values(toInsert).onConflictDoNothing().returning()
    : [];
  const skipped = skippedNames(
    departments.map((d) => d.name),
    created.map((c) => c.name),
  );
  return { created, skipped };
}

export async function updateDepartment(id: string, input: UpdateDepartmentInput) {
  if (Object.keys(input).length === 0) return getDepartment(id);
  const [row] = await db
    .update(department)
    .set(input)
    .where(eq(department.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Departamento no encontrado", "NOT_FOUND");
  return row;
}

// Sus miembros quedan sin ese departamento (cascada en `employee_department`).
export async function deleteDepartment(id: string) {
  const [row] = await db
    .delete(department)
    .where(eq(department.id, id))
    .returning({ id: department.id });
  if (!row) throw new HttpError(404, "Departamento no encontrado", "NOT_FOUND");
}

// ---------------------------------------------------------------------------
// Pertenencia empleado ↔ departamento
// ---------------------------------------------------------------------------
// Regla de jefe por defecto: si `isHead` no se indica, lo es quien tenga el rol
// admin. Es editable: un valor explícito siempre manda.
async function defaultHead(userId: string | null): Promise<boolean> {
  return userId ? queryIsAdmin(userId) : false;
}

export async function getEmployeeDepartments(employeeId: string) {
  return db
    .select({
      id: department.id,
      name: department.name,
      isHead: employeeDepartment.isHead,
    })
    .from(employeeDepartment)
    .innerJoin(department, eq(employeeDepartment.departmentId, department.id))
    .where(eq(employeeDepartment.employeeId, employeeId))
    .orderBy(asc(department.name));
}

async function assertDepartmentsExist(ids: string[]) {
  if (!ids.length) return;
  const found = await db
    .select({ id: department.id })
    .from(department)
    .where(inArray(department.id, ids));
  if (found.length !== new Set(ids).size) {
    throw new HttpError(400, "Algún departamento no existe", "BAD_REQUEST");
  }
}

// Reemplaza el conjunto de departamentos de una persona.
export async function setEmployeeDepartments(
  employeeId: string,
  userId: string | null,
  items: { departmentId: string; isHead?: boolean }[],
) {
  const byId = new Map(items.map((i) => [i.departmentId, i]));
  const ids = [...byId.keys()];
  await assertDepartmentsExist(ids);
  const admin = await defaultHead(userId);

  await db.transaction(async (tx) => {
    await tx
      .delete(employeeDepartment)
      .where(
        ids.length
          ? and(
              eq(employeeDepartment.employeeId, employeeId),
              notInArray(employeeDepartment.departmentId, ids),
            )
          : eq(employeeDepartment.employeeId, employeeId),
      );
    for (const item of byId.values()) {
      const isHead = resolveIsHead(item.isHead, admin);
      const insert = tx
        .insert(employeeDepartment)
        .values({ employeeId, departmentId: item.departmentId, isHead });
      // `isHead` explícito actualiza al jefe; omitido, conserva el valor previo.
      if (item.isHead === undefined) await insert.onConflictDoNothing();
      else {
        await insert.onConflictDoUpdate({
          target: [employeeDepartment.employeeId, employeeDepartment.departmentId],
          set: { isHead },
        });
      }
    }
  });
}

export async function listDepartmentMembers(departmentId: string) {
  await getDepartment(departmentId);
  return db
    .select({
      employeeId: employee.id,
      userId: employee.userId,
      name: employee.name,
      lastName: employee.lastName,
      email: user.email,
      isHead: employeeDepartment.isHead,
    })
    .from(employeeDepartment)
    .innerJoin(employee, eq(employeeDepartment.employeeId, employee.id))
    .leftJoin(user, eq(employee.userId, user.id))
    .where(eq(employeeDepartment.departmentId, departmentId))
    .orderBy(sql`${employeeDepartment.isHead} desc`, asc(employee.name), asc(employee.id));
}

// Asignación múltiple por id de USUARIO. Quien aún no tiene ficha de empleado
// recibe una mínima (nombre de la cuenta). Quien ya pertenece al departamento
// se omite (`skipped`). `isHead` omitido: jefe solo si es admin.
export async function addDepartmentMembers(
  departmentId: string,
  userIds: string[],
  isHead?: boolean,
) {
  await getDepartment(departmentId);
  const ids = [...new Set(userIds)];
  const users = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, ids));
  if (users.length !== ids.length) {
    throw new HttpError(400, "Algún usuario no existe", "BAD_REQUEST");
  }

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: employee.id, userId: employee.userId })
      .from(employee)
      .where(inArray(employee.userId, ids));
    const empByUser = new Map(existing.map((e) => [e.userId as string, e.id]));

    const missing = users.filter((u) => !empByUser.has(u.id));
    if (missing.length) {
      const created = await tx
        .insert(employee)
        .values(missing.map((u) => ({ userId: u.id, name: u.name, lastName: "" })))
        .returning({ id: employee.id, userId: employee.userId });
      for (const c of created) empByUser.set(c.userId as string, c.id);
    }

    const already = await tx
      .select({ employeeId: employeeDepartment.employeeId })
      .from(employeeDepartment)
      .where(
        and(
          eq(employeeDepartment.departmentId, departmentId),
          inArray(employeeDepartment.employeeId, [...empByUser.values()]),
        ),
      );
    const alreadySet = new Set(already.map((a) => a.employeeId));

    const { added, skipped } = partitionNewMembers(ids, empByUser, alreadySet);
    for (const userId of added) {
      await tx.insert(employeeDepartment).values({
        employeeId: empByUser.get(userId) as string,
        departmentId,
        isHead: resolveIsHead(isHead, await defaultHead(userId)),
      });
    }
    return { added, skipped };
  });
}

export async function removeDepartmentMember(departmentId: string, employeeId: string) {
  const [row] = await db
    .delete(employeeDepartment)
    .where(
      and(
        eq(employeeDepartment.departmentId, departmentId),
        eq(employeeDepartment.employeeId, employeeId),
      ),
    )
    .returning({ id: employeeDepartment.id });
  if (!row) throw new HttpError(404, "La persona no pertenece al departamento", "NOT_FOUND");
}

export async function setDepartmentMemberHead(
  departmentId: string,
  employeeId: string,
  isHead: boolean,
) {
  const [row] = await db
    .update(employeeDepartment)
    .set({ isHead })
    .where(
      and(
        eq(employeeDepartment.departmentId, departmentId),
        eq(employeeDepartment.employeeId, employeeId),
      ),
    )
    .returning({ id: employeeDepartment.id });
  if (!row) throw new HttpError(404, "La persona no pertenece al departamento", "NOT_FOUND");
}

// Al otorgar el rol admin a alguien, pasa a ser jefe de todos sus departamentos
// actuales (regla por defecto; luego se puede ajustar departamento a departamento).
export async function promoteToHeadEverywhere(userId: string) {
  await db
    .update(employeeDepartment)
    .set({ isHead: true })
    .where(
      inArray(
        employeeDepartment.employeeId,
        db.select({ id: employee.id }).from(employee).where(eq(employee.userId, userId)),
      ),
    );
}
