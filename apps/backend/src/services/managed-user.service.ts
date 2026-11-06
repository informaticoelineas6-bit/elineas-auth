import { user } from "@backend/db/auth-schema.ts";
import {
  employee,
  role,
  system,
  userRole,
} from "@backend/db/business-schema.ts";
import { db } from "@backend/db/index.ts";
import { HttpError } from "@backend/lib/http.ts";
import { escapeLike } from "@backend/lib/search.ts";
import { toOffset, type PaginationInput } from "@backend/lib/pagination.ts";
import type { UpdateManagedUserBodySchema } from "@backend/openapi/business.schemas.ts";
import { updateEmployee } from "@backend/services/employee.service.ts";
import {
  canManage,
  scopeFilter,
  type ManageScope,
} from "@backend/services/system-admin.service.ts";
import type { z } from "@hono/zod-openapi";
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

type UpdateManagedUserInput = z.infer<typeof UpdateManagedUserBodySchema>;

// ¿Tiene el usuario algún rol dentro de los sistemas `systemIds`?
function hasRoleIn(systemIds: string[]) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .where(
        and(eq(userRole.userId, user.id), inArray(role.systemId, systemIds)),
      ),
  );
}

// Usuarios con al menos un rol en los sistemas del alcance (o en el sistema
// pedido). Para cada uno: sus roles dentro del alcance y si es `editable`.
export async function listManagedUsers(
  scope: ManageScope,
  filters: { search?: string; systemId?: string },
  pagination: PaginationInput,
) {
  const ids = scopeFilter(scope, filters.systemId);
  const term = filters.search ? `%${escapeLike(filters.search)}%` : undefined;
  const where = and(
    // Superadmin sin filtro (`ids` undefined): cualquiera con algún rol.
    ids
      ? hasRoleIn(ids)
      : exists(
          db
            .select({ one: sql`1` })
            .from(userRole)
            .where(eq(userRole.userId, user.id)),
        ),
    term
      ? or(
          ilike(user.name, term),
          ilike(user.email, term),
          ilike(employee.name, term),
          ilike(employee.lastName, term),
        )
      : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeLastName: employee.lastName,
        ci: employee.ci,
        phoneNumber: employee.phoneNumber,
        address: employee.address,
        employeeActive: employee.active,
      })
      .from(user)
      .leftJoin(employee, eq(employee.userId, user.id))
      .where(where)
      .orderBy(asc(sql`lower(${user.name})`), asc(user.id))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db
      .select({ total: count() })
      .from(user)
      .leftJoin(employee, eq(employee.userId, user.id))
      .where(where),
  ]);

  const userIds = rows.map((r) => r.id);
  const roleRows = userIds.length
    ? await db
        .select({
          userId: userRole.userId,
          id: role.id,
          name: role.name,
          systemId: system.id,
          systemSlug: system.slug,
          systemName: system.name,
        })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .innerJoin(system, eq(role.systemId, system.id))
        .where(
          and(
            inArray(userRole.userId, userIds),
            ids ? inArray(role.systemId, ids) : undefined,
          ),
        )
        .orderBy(asc(system.name), asc(role.name))
    : [];

  // Quiénes tienen roles FUERA del alcance (cuenta compartida: no editable).
  const outside = new Set<string>();
  if (!scope.all && userIds.length) {
    const outsideRows = await db
      .select({ userId: userRole.userId })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .where(
        and(
          inArray(userRole.userId, userIds),
          notInArray(role.systemId, scope.systemIds.length ? scope.systemIds : ["00000000-0000-0000-0000-000000000000"]),
        ),
      );
    for (const r of outsideRows) outside.add(r.userId);
  }

  const users = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    active: r.employeeActive ?? true,
    employee: r.employeeId
      ? {
          id: r.employeeId,
          name: r.employeeName as string,
          lastName: r.employeeLastName as string,
          ci: r.ci,
          phoneNumber: r.phoneNumber,
          address: r.address,
          active: r.employeeActive as boolean,
        }
      : null,
    roles: roleRows
      .filter((x) => x.userId === r.id)
      .map((x) => ({
        id: x.id,
        name: x.name,
        system: { id: x.systemId, slug: x.systemSlug, name: x.systemName },
      })),
    editable: scope.all || !outside.has(r.id),
  }));
  return { rows: users, total };
}

// Sistemas donde el usuario tiene algún rol (consulta directa a BD).
async function systemsOfUser(userId: string) {
  const rows = await db
    .selectDistinct({ systemId: role.systemId })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .where(eq(userRole.userId, userId));
  return rows.map((r) => r.systemId);
}

// El usuario es "de su sistema": tiene al menos un rol en uno que administra.
// (Para reenviar la invitación basta con esto.)
export async function assertUserInScope(scope: ManageScope, userId: string) {
  const systems = await systemsOfUser(userId);
  if (!systems.some((s) => canManage(scope, s))) {
    // 404 y no 403: no se revela que la cuenta existe fuera de su alcance.
    throw new HttpError(404, "Usuario no encontrado", "NOT_FOUND");
  }
  return systems;
}

// Editar datos o fijar la contraseña de una cuenta GLOBAL solo se permite si
// TODOS sus roles caen en sistemas que administra quien actúa: si tuviera roles
// en otro sistema (o fuera superadmin, que tiene rol en `auth`), cambiarle la
// contraseña o el correo sería apropiarse de una cuenta que no es solo suya.
// Consulta directa a BD, sin caché.
export async function assertUserEditable(scope: ManageScope, userId: string) {
  const systems = await assertUserInScope(scope, userId);
  if (!systems.every((s) => canManage(scope, s))) {
    throw new HttpError(
      403,
      "Este usuario también tiene roles en otros sistemas: solo puedes gestionar sus roles de tu sistema",
      "USER_SHARED",
    );
  }
}

export async function updateManagedUser(
  userId: string,
  input: UpdateManagedUserInput,
) {
  if (input.email !== undefined) {
    const [taken] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(ilike(user.email, escapeLike(input.email)), ne(user.id, userId)))
      .limit(1);
    if (taken) {
      throw new HttpError(409, "Ya existe una cuenta con ese correo", "CONFLICT");
    }
  }

  if (input.employee && Object.keys(input.employee).length > 0) {
    const [emp] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(eq(employee.userId, userId))
      .limit(1);
    if (!emp) {
      throw new HttpError(
        409,
        "Este usuario no tiene ficha de empleado que editar",
        "NO_EMPLOYEE",
      );
    }
    await updateEmployee(emp.id, input.employee);
  }

  const patch: { name?: string; email?: string; emailVerified?: boolean } = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) {
    patch.email = input.email.toLowerCase();
    patch.emailVerified = false;
  }
  if (Object.keys(patch).length > 0) {
    await db.update(user).set(patch).where(eq(user.id, userId));
  }
}
