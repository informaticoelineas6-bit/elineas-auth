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

// ¿Tiene el usuario el permiso "resource:action" dentro de `systemSlug`? Hay
// DOS comodines que pasan sin necesidad de filas en role_permission:
//   - Rol admin en el sistema `auth` (env.ADMIN_SYSTEM_SLUG): superusuario
//     global del IS, igual que en requireAdmin.
//   - Rol admin dentro del propio `systemSlug` consultado: comodín LOCAL de
//     ese sistema, para que cada app consumidora no tenga que asignar
//     manualmente cada permiso a su propio rol admin.
// Ver la misma lógica, ya generalizada, en permission.service.ts#listMyPermissions
// (usada por /api/permissions/me): ambas deben coincidir, o un panel podría
// mostrar un botón que luego el 403 de este middleware rechaza.
async function queryHasPermission(
  userId: string,
  systemSlug: string,
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
        or(
          and(
            eq(system.slug, env.ADMIN_SYSTEM_SLUG),
            eq(role.name, env.ADMIN_ROLE_NAME),
          ),
          and(eq(system.slug, systemSlug), eq(role.name, env.ADMIN_ROLE_NAME)),
          and(
            eq(system.slug, systemSlug),
            eq(permission.resource, resource),
            eq(permission.action, action),
          ),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function hasPermission(
  userId: string,
  systemSlug: string,
  resource: string,
  action: string,
): Promise<boolean> {
  const cacheKey = `perm:${systemSlug}:${userId}:${resource}:${action}`;

  if (redis) {
    try {
      const cached = await redisCommand(() => redis!.send("GET", [cacheKey]));
      if (cached === "1") return true;
      if (cached === "0") return false;
    } catch {
      // Redis no disponible o lento: seguimos con la consulta a BD.
    }
  }

  const result = await queryHasPermission(userId, systemSlug, resource, action);

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

// Exige que el usuario autenticado tenga el permiso "resource:action" (o
// alguno de los dos comodines admin, ver queryHasPermission) dentro de
// `systemSlug`. Sin ese tercer argumento, comprueba el sistema que
// representa a este propio identity server (env.ADMIN_SYSTEM_SLUG) — el
// caso de todas las rutas de este backend (employees, sessions, users,
// tkc, request-logs), que no cambian de comportamiento con esta
// generalización. Un sistema consumidor externo que delegue su
// autorización fina en el IS pasa aquí su propio slug.
//
// Debe ejecutarse DESPUÉS de requireSession (que puebla c.get("user")),
// igual que requireAdmin.
export function requirePermission(
  resource: string,
  action: string,
  systemSlug: string = env.ADMIN_SYSTEM_SLUG,
) {
  return async function requirePermissionMiddleware(
    c: Context<AppEnv>,
    next: Next,
  ) {
    const user = c.get("user");
    if (!user) return c.json({ error: "No autorizado" }, 401);

    if (!(await hasPermission(user.id, systemSlug, resource, action))) {
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
