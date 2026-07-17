import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "@hono/zod-openapi";
import { db } from "@/db/index";
import { employee } from "@/db/business-schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { sendWelcomeEmail } from "@/lib/mail";
import { escapeLike } from "@/lib/search";
import { toOffset, type PaginationInput } from "@/lib/pagination";
import type {
  CreateEmployeeBodySchema,
  UpdateEmployeeBodySchema,
} from "@/openapi/business.schemas";
import type { CreateEmployeeWithUserBodySchema } from "@/openapi/schemas";

type CreateEmployeeInput = z.infer<typeof CreateEmployeeBodySchema>;
type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeBodySchema>;
type CreateEmployeeWithUserInput = z.infer<typeof CreateEmployeeWithUserBodySchema>;

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
            ilike(user.email, term),
          );
        })()
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  // LEFT JOIN con user para embeber la cuenta enlazada (y permitir buscar por
  // email). Filas de la página y total en paralelo: comparten `where` y el
  // mismo join para que el total refleje los filtros aplicados.
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: employee.id,
        userId: employee.userId,
        name: employee.name,
        lastName: employee.lastName,
        ci: employee.ci,
        birthday: employee.birthday,
        phoneNumber: employee.phoneNumber,
        address: employee.address,
        inDate: employee.inDate,
        outDate: employee.outDate,
        active: employee.active,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
        user: { id: user.id, name: user.name, email: user.email },
      })
      .from(employee)
      .leftJoin(user, eq(employee.userId, user.id))
      .where(where)
      .orderBy(desc(employee.createdAt))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db
      .select({ total: count() })
      .from(employee)
      .leftJoin(user, eq(employee.userId, user.id))
      .where(where),
  ]);

  // El LEFT JOIN devuelve el objeto `user` con campos null cuando el empleado
  // no tiene cuenta; lo normalizamos a `null` para respetar el contrato user | null.
  const normalized = rows.map((row) => ({
    ...row,
    user: row.user?.id ? row.user : null,
  }));

  return { rows: normalized, total };
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
) {
  const [existing] = await db
    .select({ id: employee.id })
    .from(employee)
    .where(eq(employee.ci, input.employee.ci))
    .limit(1);
  if (existing) {
    throw new HttpError(409, "Ya existe un empleado con ese CI", "CONFLICT");
  }

  const { response } = await auth.api.signUpEmail({
    body: input.user,
    headers,
    returnHeaders: true,
  });

  try {
    const [row] = await db
      .insert(employee)
      .values({ ...input.employee, userId: response.user.id })
      .returning();
    // El correo de credenciales se envía solo cuando el alta completa (usuario
    // + empleado) tuvo éxito: si el insert falla, el usuario se compensa/borra
    // y no debe recibir aviso. Sin await: un fallo del correo no aborta el alta
    // (sendWelcomeEmail captura y loguea sus propios errores, nunca lanza).
    void sendWelcomeEmail({
      to: input.user.email,
      name: input.user.name,
      password: input.user.password,
    });
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
