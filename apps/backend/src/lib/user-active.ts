import { and, eq } from "drizzle-orm";
import { session } from "@backend/db/auth-schema.ts";
import { employee } from "@backend/db/business-schema.ts";
import { db } from "@backend/db/index.ts";

// Un usuario está desactivado cuando tiene una ficha de empleado enlazada con
// `active = false`. Sin ficha (cuentas de servicio, admins sin empleado) no se
// bloquea: la bandera solo existe en el empleado.
export async function isUserDeactivated(userId: string) {
  const [row] = await db
    .select({ id: employee.id })
    .from(employee)
    .where(and(eq(employee.userId, userId), eq(employee.active, false)))
    .limit(1);
  return row !== undefined;
}

// Cierra todas las sesiones del usuario (las cookies/tokens opacos dejan de
// resolver al instante; los JWT ya emitidos los corta requireIdentity).
export async function revokeAllUserSessions(userId: string) {
  await db.delete(session).where(eq(session.userId, userId));
}
