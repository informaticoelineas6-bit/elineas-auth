import { and, count, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@backend/db/index.ts";
import { department, employee, employeeDepartment } from "@backend/db/business-schema.ts";
import { user } from "@backend/db/auth-schema.ts";
import { auth } from "@backend/lib/auth.ts";
import {
  invalidateUserActiveCache,
  revokeAllUserSessions,
} from "@backend/lib/user-active.ts";
import {
  getEmployeeDepartments,
  setEmployeeDepartments,
} from "@backend/services/department.service.ts";
import { HttpError } from "@backend/lib/http.ts";
import { enqueueAccountInvite, generateInitialPassword } from "@backend/lib/invite.ts";
import { queryIsAdmin } from "@backend/middleware/admin.ts";
import { escapeLike } from "@backend/lib/search.ts";
import { buildOrderBy, type SortInput } from "@backend/lib/sorting.ts";
import { toOffset, type PaginationInput } from "@backend/lib/pagination.ts";
import type {
  CreateEmployeeBodySchema,
  UpdateEmployeeBodySchema,
} from "@backend/openapi/business.schemas.ts";
import type { CreateEmployeeWithUserBodySchema } from "@backend/openapi/schemas.ts";

type CreateEmployeeInput = z.infer<typeof CreateEmployeeBodySchema>;
type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeBodySchema>;
type CreateEmployeeWithUserInput = z.infer<typeof CreateEmployeeWithUserBodySchema>;

// El listado parte de las CUENTAS (`user`) y no de las fichas: un usuario sin
// ficha de empleado (p. ej. importado de otro sistema) también aparece, con
// `hasProfile: false`. Para esas filas `id` es el id del usuario (solo sirve
// como clave de fila; no existe /employees/{id}) y nombre/estado salen de la
// cuenta. Las fichas sin cuenta siguen apareciendo (FULL JOIN).
export async function listEmployees(
  filters: { active?: boolean; search?: string; departmentId?: string },
  pagination: PaginationInput,
  sort?: SortInput<
    "name" | "email" | "ci" | "phoneNumber" | "inDate" | "outDate" | "active" | "createdAt"
  >,
) {
  const active = sql<boolean>`coalesce(${employee.active}, true)`;
  const createdAt = sql`coalesce(${employee.createdAt}, ${user.createdAt})`.mapWith(employee.createdAt);
  const displayName = sql<string>`coalesce(${employee.name}, ${user.name})`;

  const conditions = [
    filters.active === undefined ? undefined : sql`${active} = ${filters.active}`,
    filters.departmentId
      ? inArray(
          employee.id,
          db
            .select({ id: employeeDepartment.employeeId })
            .from(employeeDepartment)
            .where(eq(employeeDepartment.departmentId, filters.departmentId)),
        )
      : undefined,
    filters.search
      ? (() => {
          const term = `%${escapeLike(filters.search)}%`;
          return or(
            ilike(employee.name, term),
            ilike(employee.lastName, term),
            ilike(employee.ci, term),
            ilike(user.name, term),
            ilike(user.email, term),
          );
        })()
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        employeeId: employee.id,
        userId: sql<string | null>`${user.id}`,
        name: displayName,
        lastName: sql<string>`coalesce(${employee.lastName}, '')`,
        ci: employee.ci,
        birthday: employee.birthday,
        phoneNumber: employee.phoneNumber,
        address: employee.address,
        inDate: employee.inDate,
        outDate: employee.outDate,
        active,
        createdAt,
        updatedAt: sql`coalesce(${employee.updatedAt}, ${user.updatedAt})`.mapWith(employee.updatedAt),
        user: { id: user.id, name: user.name, email: user.email },
      })
      .from(user)
      .fullJoin(employee, eq(employee.userId, user.id))
      .where(where)
      .orderBy(
        ...buildOrderBy(
          sort,
          {
            name: sql`lower(trim(${displayName} || ' ' || coalesce(${employee.lastName}, '')))`,
            email: sql`lower(${user.email})`,
            ci: employee.ci,
            phoneNumber: employee.phoneNumber,
            inDate: employee.inDate,
            outDate: employee.outDate,
            active,
            createdAt,
          },
          [createdAt, sql`coalesce(${employee.id}, ${user.id})`],
        ),
      )
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db
      .select({ total: count() })
      .from(user)
      .fullJoin(employee, eq(employee.userId, user.id))
      .where(where),
  ]);

  // Departamentos de las fichas de esta página (una sola consulta extra).
  const employeeIds = rows.flatMap((r) => (r.employeeId ? [r.employeeId] : []));
  const memberships = employeeIds.length
    ? await db
        .select({
          employeeId: employeeDepartment.employeeId,
          id: department.id,
          name: department.name,
          isHead: employeeDepartment.isHead,
        })
        .from(employeeDepartment)
        .innerJoin(department, eq(employeeDepartment.departmentId, department.id))
        .where(inArray(employeeDepartment.employeeId, employeeIds))
        .orderBy(department.name)
    : [];
  const byEmployee = new Map<string, { id: string; name: string; isHead: boolean }[]>();
  for (const { employeeId, ...m } of memberships) {
    byEmployee.set(employeeId, [...(byEmployee.get(employeeId) ?? []), m]);
  }

  // FULL JOIN: `user` llega con campos null cuando la ficha no tiene cuenta.
  const normalized = rows.map(({ employeeId, ...row }) => ({
    ...row,
    departments: (employeeId && byEmployee.get(employeeId)) || [],
    id: employeeId ?? row.user?.id ?? "",
    hasProfile: employeeId !== null,
    user: row.user?.id ? row.user : null,
  }));

  return { rows: normalized, total };
}

// Ficha + sus departamentos (para el detalle/edición).
export async function getEmployeeWithDepartments(id: string) {
  const row = await getEmployee(id);
  return { ...row, departments: await getEmployeeDepartments(id) };
}

export async function getEmployee(id: string) {
  const [row] = await db.select().from(employee).where(eq(employee.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Empleado no encontrado", "NOT_FOUND");
  return row;
}

export async function createEmployee(input: CreateEmployeeInput) {
  // El CI es opcional: el pre-chequeo de unicidad solo aplica cuando se envía
  // uno (igual que en `createEmployeeWithUser`). Sin esto, un CI duplicado
  // solo se detectaba al chocar con la restricción UNIQUE de la BD, que cae en
  // el mensaje genérico de `handleError` ("El recurso ya existe...") en vez del
  // mensaje específico que espera el frontend para señalar el campo.
  if (input.ci !== undefined) {
    const [existing] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(eq(employee.ci, input.ci))
      .limit(1);
    if (existing) {
      throw new HttpError(409, "Ya existe un empleado con ese CI", "CONFLICT");
    }
  }

  const { departments, ...data } = input;
  const [row] = await db.insert(employee).values(data).returning();
  if (departments) await setEmployeeDepartments(row.id, row.userId, departments);
  return row;
}

// Alta combinada: crea el usuario (vía better-auth) y el empleado enlazado en
// una sola operación de cara al cliente.
//
// No hay una transacción única que abarque ambos pasos: `signUpEmail` escribe
// en la BD por su cuenta (tablas user/account), fuera del control de una
// transacción de Drizzle. Por eso se usa el patrón pre-chequeo + compensación:
//   1. Se comprueba que el CI no exista ANTES de crear el usuario, para que el
//      caso habitual de CI duplicado falle sin dejar rastro (409, sin usuario).
//   2. Se crea el usuario.
//   3. Se inserta el empleado; si ese insert falla (p. ej. una carrera contra
//      el paso 1, o el userId ya ligado a otro empleado), se borra el usuario
//      recién creado para no dejar cuentas huérfanas y se relanza el error.
// El borrado del usuario cascadea a account/session (FK onDelete: cascade).
export async function createEmployeeWithUser(
  input: CreateEmployeeWithUserInput,
  headers: Headers,
  callerId: string,
) {
  // Fijar la contraseña de la cuenta nueva solo lo puede hacer un admin: un
  // delegado con `employees:write` que la eligiera conocería las credenciales de
  // una cuenta a la que un admin podría dar roles después (o podría pre-registrar
  // el correo de otra persona). Sin contraseña, el dueño la fija con el enlace.
  if (input.user.password !== undefined && !(await queryIsAdmin(callerId))) {
    throw new HttpError(
      403,
      "Solo un administrador puede fijar la contraseña de una cuenta nueva",
      "FORBIDDEN",
    );
  }

  // El CI ahora es opcional: el pre-chequeo de unicidad solo aplica cuando se
  // envía uno. Con múltiples empleados sin CI, la restricción UNIQUE de la BD
  // no los rechaza (Postgres permite varios NULL en una columna UNIQUE).
  if (input.employee.ci !== undefined) {
    const [existing] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(eq(employee.ci, input.employee.ci))
      .limit(1);
    if (existing) {
      throw new HttpError(409, "Ya existe un empleado con ese CI", "CONFLICT");
    }
  }

  const { response } = await auth.api.signUpEmail({
    // Sin contraseña: aleatoria e inservible; el dueño la fija con el enlace.
    body: { ...input.user, password: input.user.password ?? generateInitialPassword() },
    headers,
    returnHeaders: true,
  });

  try {
    const { departments, ...employeeData } = input.employee;
    const [row] = await db
      .insert(employee)
      .values({ ...employeeData, userId: response.user.id })
      .returning();
    if (departments) await setEmployeeDepartments(row.id, row.userId, departments);
    // La invitación se envía solo cuando el alta completa (usuario + empleado)
    // tuvo éxito: si el insert falla, el usuario se compensa/borra y no debe
    // recibir aviso. Va a una cola serializada (sin await): un fallo del correo
    // no aborta el alta (sendAccountInvite captura y loguea, nunca lanza).
    if (input.sendInvite !== false) enqueueAccountInvite(input.user.email);
    return { user: response.user, employee: row };
  } catch (error) {
    // Compensación: borra el usuario recién creado para no dejar una cuenta
    // huérfana. Su propio fallo (p. ej. BD caída a mitad) se registra pero NO
    // se propaga: relanzar el error de compensación enmascararía el error real
    // del insert, que es el que explica al cliente por qué falló la operación.
    try {
      await db.delete(user).where(eq(user.id, response.user.id));
    } catch (cleanupError) {
      console.error(
        `No se pudo revertir el usuario huérfano ${response.user.id} tras fallar el alta del empleado:`,
        cleanupError instanceof Error ? cleanupError.message : cleanupError,
      );
    }
    throw error;
  }
}

// Crea la cuenta de acceso de un empleado que aún no tiene una y la enlaza.
// Mismo patrón que `createEmployeeWithUser`: crea el usuario (contraseña
// aleatoria) y enlaza; si el enlace falla, borra el usuario para no dejar
// cuentas huérfanas.
export async function createAccountForEmployee(
  id: string,
  input: { email: string; name?: string; sendInvite?: boolean },
  headers: Headers,
) {
  const emp = await getEmployee(id);
  if (emp.userId) {
    throw new HttpError(409, "El empleado ya tiene una cuenta de usuario", "CONFLICT");
  }

  const { response } = await auth.api.signUpEmail({
    body: {
      name: (input.name ?? `${emp.name} ${emp.lastName}`).slice(0, 100),
      email: input.email,
      password: generateInitialPassword(),
    },
    headers,
    returnHeaders: true,
  });

  try {
    // Condición `userId IS NULL`: evita enlazar dos cuentas si hubo una carrera.
    const [row] = await db
      .update(employee)
      .set({ userId: response.user.id })
      .where(and(eq(employee.id, id), isNull(employee.userId)))
      .returning();
    if (!row) {
      throw new HttpError(409, "El empleado ya tiene una cuenta de usuario", "CONFLICT");
    }
    if (input.sendInvite !== false) enqueueAccountInvite(input.email);
    return { user: response.user, employee: row };
  } catch (error) {
    try {
      await db.delete(user).where(eq(user.id, response.user.id));
    } catch (cleanupError) {
      console.error(
        `No se pudo revertir el usuario huérfano ${response.user.id}:`,
        cleanupError instanceof Error ? cleanupError.message : cleanupError,
      );
    }
    throw error;
  }
}

export async function updateEmployee(id: string, fullInput: UpdateEmployeeInput) {
  const { departments, ...input } = fullInput;
  if (Object.keys(input).length === 0) {
    const current = await getEmployee(id);
    if (departments) await setEmployeeDepartments(id, current.userId, departments);
    return current;
  }

  // Mismo pre-chequeo que en el alta, excluyendo el propio registro (si no,
  // guardar sin cambiar el CI chocaría contra sí mismo).
  if (input.ci !== undefined) {
    const [existing] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(and(eq(employee.ci, input.ci), ne(employee.id, id)))
      .limit(1);
    if (existing) {
      throw new HttpError(409, "Ya existe un empleado con ese CI", "CONFLICT");
    }
  }

  const [row] = await db
    .update(employee)
    .set(input)
    .where(eq(employee.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Empleado no encontrado", "NOT_FOUND");
  if (departments) await setEmployeeDepartments(id, row.userId, departments);
  await invalidateUserActiveCache(row.userId);
  // Desactivar corta el acceso ya: se cierran sus sesiones abiertas.
  if (input.active === false && row.userId) {
    await revokeAllUserSessions(row.userId);
  }
  return row;
}

// Elimina el empleado y, si tiene una cuenta enlazada, también esa cuenta.
//
// La FK employee.userId es `set null`, así que borrar solo el empleado dejaba
// la cuenta viva con sus roles y sesiones: el usuario seguía apareciendo en las
// asignaciones y podía seguir iniciando sesión pese a estar "eliminado". Borrar
// el user cascadea a account/session (auth-schema) y a userRole/sessionSystem
// (business-schema), que es lo que espera la acción "Eliminar usuario".
//
// Ambos borrados van en una transacción: si el del user falla, el empleado no
// desaparece a medias.
export async function deleteEmployee(id: string, currentUserId?: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(employee)
      .where(eq(employee.id, id))
      .returning({ userId: employee.userId });
    if (!row) throw new HttpError(404, "Empleado no encontrado", "NOT_FOUND");
    if (!row.userId) return;
    // Auto-borrado: eliminaría la cuenta de quien llama junto con su sesión
    // actual. La excepción revierte también el borrado del empleado.
    if (row.userId === currentUserId) {
      throw new HttpError(
        409,
        "No puedes eliminar tu propio usuario",
        "CONFLICT",
      );
    }
    // Borrar el usuario de un admin (cascada a roles y sesiones) le quitaría el
    // acceso: solo otro admin puede hacerlo. Consulta directa a BD (sin caché)
    // para no decidir con un dato de hasta 30 s de antigüedad.
    if (
      (await queryIsAdmin(row.userId)) &&
      !(currentUserId && (await queryIsAdmin(currentUserId)))
    ) {
      throw new HttpError(
        403,
        "Solo un administrador puede eliminar a un administrador",
        "FORBIDDEN",
      );
    }
    await tx.delete(user).where(eq(user.id, row.userId));
  });
}

// Elimina una cuenta de usuario que no tiene ficha de empleado (p. ej. importada
// de otro sistema). Cascadea a account/session/userRole/sessionSystem. Si el
// usuario sí tiene ficha, se rechaza: debe borrarse desde la ficha.
export async function deleteUserAccount(userId: string, currentUserId?: string) {
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!target) throw new HttpError(404, "Usuario no encontrado", "NOT_FOUND");
    if (userId === currentUserId) {
      throw new HttpError(409, "No puedes eliminar tu propio usuario", "CONFLICT");
    }
    const [profile] = await tx
      .select({ id: employee.id })
      .from(employee)
      .where(eq(employee.userId, userId))
      .limit(1);
    if (profile) {
      throw new HttpError(
        409,
        "El usuario tiene ficha de empleado: elimínalo desde la ficha",
        "CONFLICT",
      );
    }
    if (
      (await queryIsAdmin(userId)) &&
      !(currentUserId && (await queryIsAdmin(currentUserId)))
    ) {
      throw new HttpError(
        403,
        "Solo un administrador puede eliminar a un administrador",
        "FORBIDDEN",
      );
    }
    await tx.delete(user).where(eq(user.id, userId));
  });
}
