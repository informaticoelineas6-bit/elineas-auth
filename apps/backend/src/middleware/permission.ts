import { env } from "@backend/config/env.ts";
import {
  permission,
  role,
  rolePermission,
  system,
  userRole,
} from "@backend/db/business-schema.ts";
import { db } from "@backend/db/index.ts";
import { redis, redisCommand } from "@backend/lib/redis.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { and, eq, or } from "drizzle-orm";
import type { Context, Next } from "hono";

// Misma idea de caché que middleware/admin.ts: TTL corto para que revocar un
// permiso (o el rol que lo lleva) tarde como mucho esto en reflejarse.
const PERMISSION_CACHE_TTL_SECONDS = 30;

// ¿Tiene el usuario, dentro del sistema que representa a este identity
// server, el permiso "resource:action"? El rol admin es un comodín: pasa
// siempre, sin necesidad de filas en role_permission (es el superusuario del
// IS, igual que en requireAdmin).
async function queryHasPermission(
  userId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userRole.id })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(system, eq(role.systemId, system.id))
    .leftJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .leftJoin(permission, eq(permission.id, rolePermission.permissionId))
    .where(
      and(
        eq(userRole.userId, userId),
        eq(system.slug, env.ADMIN_SYSTEM_SLUG),
        or(
          eq(role.name, env.ADMIN_ROLE_NAME),
          and(eq(permission.resource, resource), eq(permission.action, action)),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function hasPermission(
  userId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  const cacheKey = `perm:${userId}:${resource}:${action}`;

  if (redis) {
    try {
      const cached = await redisCommand(() => redis!.send("GET", [cacheKey]));
      if (cached === "1") return true;
      if (cached === "0") return false;
    } catch {
      // Redis no disponible o lento: seguimos con la consulta a BD.
    }
  }

  const result = await queryHasPermission(userId, resource, action);

  if (redis) {
    try {
      await redisCommand(() =>
        redis!.send("SET", [
          cacheKey,
          result ? "1" : "0",
          "EX",
          String(PERMISSION_CACHE_TTL_SECONDS),
        ]),
      );
    } catch {
      // Si no se puede cachear, no pasa nada: la próxima vez se recalcula.
    }
  }

  return result;
}

// Exige que el usuario autenticado tenga el permiso "resource:action" (o el
// rol admin, que es comodín) dentro del sistema que representa a este
// identity server. Debe ejecutarse DESPUÉS de requireSession (que puebla
// c.get("user")), igual que requireAdmin.
export function requirePermission(resource: string, action: string) {
  return async function requirePermissionMiddleware(
    c: Context<AppEnv>,
    next: Next,
  ) {
    const user = c.get("user");
    if (!user) return c.json({ error: "No autorizado" }, 401);

    if (!(await hasPermission(user.id, resource, action))) {
      return c.json(
        {
          error: `Requiere el permiso "${resource}:${action}"`,
          code: "FORBIDDEN",
        },
        403,
      );
    }
    await next();
  };
}
