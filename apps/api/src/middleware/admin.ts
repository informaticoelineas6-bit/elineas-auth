import type { Context, Next } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { role, system, userRole } from "@/db/business-schema";
import { redis, redisCommand } from "@/lib/redis";
import { env } from "@/config/env";
import type { AppEnv } from "@/types/hono-env";

// TTL de la caché de pertenencia a admin. Corto a propósito: si se revoca el rol
// admin, el acceso caduca como mucho en este intervalo. Cachear evita repetir un
// JOIN de 3 tablas en cada petición a rutas de administración (ruta caliente).
const ADMIN_CACHE_TTL_SECONDS = 30;

// Consulta directa a BD: ¿tiene el usuario el rol admin en el sistema que
// representa a este identity server?
async function queryIsAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userRole.id })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(system, eq(role.systemId, system.id))
    .where(
      and(
        eq(userRole.userId, userId),
        eq(role.name, env.ADMIN_ROLE_NAME),
        eq(system.slug, env.ADMIN_SYSTEM_SLUG),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// Pertenencia a admin con caché en Redis (si está disponible). Un fallo de Redis
// nunca bloquea: se cae a la consulta a BD.
async function isAdmin(userId: string): Promise<boolean> {
  const cacheKey = `admin:${userId}`;

  if (redis) {
    try {
      const cached = await redisCommand(() => redis!.send("GET", [cacheKey]));
      if (cached === "1") return true;
      if (cached === "0") return false;
    } catch {
      // Redis no disponible o lento: seguimos con la consulta a BD.
    }
  }

  const result = await queryIsAdmin(userId);

  if (redis) {
    try {
      await redisCommand(() =>
        redis!.send("SET", [
          cacheKey,
          result ? "1" : "0",
          "EX",
          String(ADMIN_CACHE_TTL_SECONDS),
        ]),
      );
    } catch {
      // Si no se puede cachear, no pasa nada: la próxima vez se recalcula.
    }
  }

  return result;
}

// Exige que el usuario autenticado tenga el rol admin dentro del sistema que
// representa a este identity server (env.ADMIN_SYSTEM_SLUG / ADMIN_ROLE_NAME).
// Debe ejecutarse DESPUÉS de requireSession (que puebla c.get("user")).
export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const user = c.get("user");
  if (!user) return c.json({ error: "No autorizado" }, 401);

  if (!(await isAdmin(user.id))) {
    return c.json(
      { error: "Requiere privilegios de administrador", code: "FORBIDDEN" },
      403,
    );
  }
  await next();
}
