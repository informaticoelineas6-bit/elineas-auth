import { and, eq } from "drizzle-orm";
import { session } from "@backend/db/auth-schema.ts";
import { employee } from "@backend/db/business-schema.ts";
import { db } from "@backend/db/index.ts";
import { redis, redisCommand } from "@backend/lib/redis.ts";

// Caché corta del estado "desactivado": isUserDeactivated corre en CADA petición
// autenticada. El TTL es corto y además se invalida explícitamente al cambiar
// el empleado (ver invalidateUserActiveCache), así que desactivar sigue
// cortando el acceso de inmediato; el TTL solo cubre cambios hechos fuera de
// este servicio.
const ACTIVE_CACHE_TTL_SECONDS = 15;
const cacheKey = (userId: string) => `deactivated:${userId}`;

export async function invalidateUserActiveCache(
  userId: string | null | undefined,
) {
  if (!redis || !userId) return;
  try {
    await redisCommand(() => redis!.send("DEL", [cacheKey(userId)]));
  } catch {
    // Sin Redis no hay caché que invalidar.
  }
}

// Un usuario está desactivado cuando tiene una ficha de empleado enlazada con
// `active = false`. Sin ficha (cuentas de servicio, admins sin empleado) no se
// bloquea: la bandera solo existe en el empleado.
export async function isUserDeactivated(userId: string) {
  if (redis) {
    try {
      const cached = await redisCommand(() =>
        redis!.send("GET", [cacheKey(userId)]),
      );
      if (cached === "1") return true;
      if (cached === "0") return false;
    } catch {
      // Redis no disponible o lento: se consulta la BD.
    }
  }

  const result = await queryUserDeactivated(userId);

  if (redis) {
    try {
      await redisCommand(() =>
        redis!.send("SET", [
          cacheKey(userId),
          result ? "1" : "0",
          "EX",
          String(ACTIVE_CACHE_TTL_SECONDS),
        ]),
      );
    } catch {
      // No pasa nada: la próxima vez se recalcula.
    }
  }
  return result;
}

async function queryUserDeactivated(userId: string) {
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
