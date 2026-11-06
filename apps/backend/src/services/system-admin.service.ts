import { env } from "@backend/config/env.ts";
import { role, system, userRole } from "@backend/db/business-schema.ts";
import { db } from "@backend/db/index.ts";
import { HttpError } from "@backend/lib/http.ts";
import { redis, redisCommand } from "@backend/lib/redis.ts";
import { and, eq } from "drizzle-orm";

// Alcance de administración de un usuario:
//   - `all`: superadmin del IS (rol admin en el sistema `auth`), gestiona todo.
//   - `systemIds`: sistemas ACTIVOS donde tiene el rol admin (comodín local).
//     Nunca incluye el sistema `auth`: sobre ese solo manda el superadmin.
export type ManageScope =
  | { all: true }
  | { all: false; systemIds: string[] };

const SCOPE_CACHE_TTL_SECONDS = 30;
const scopeCacheKey = (userId: string) => `sysadmin:${userId}`;

// ---- Helpers puros (sin BD): fáciles de testear ----

export function isScopeEmpty(scope: ManageScope): boolean {
  return !scope.all && scope.systemIds.length === 0;
}

export function canManage(scope: ManageScope, systemId: string): boolean {
  return scope.all || scope.systemIds.includes(systemId);
}

export function assertCanManageSystem(scope: ManageScope, systemId: string) {
  if (!canManage(scope, systemId)) {
    throw new HttpError(
      403,
      "No administras este sistema",
      "FORBIDDEN",
    );
  }
}

// Traduce el alcance a un filtro de listado. `undefined` = sin restricción
// (superadmin sin filtro). Si se pide un sistema concreto, debe estar dentro
// del alcance; si no, 403.
export function scopeFilter(
  scope: ManageScope,
  requestedSystemId?: string,
): string[] | undefined {
  if (requestedSystemId) {
    assertCanManageSystem(scope, requestedSystemId);
    return [requestedSystemId];
  }
  return scope.all ? undefined : scope.systemIds;
}

// ---- Consulta y caché ----

export async function queryManageScope(userId: string): Promise<ManageScope> {
  const rows = await db
    .select({ id: system.id, slug: system.slug, active: system.active })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(system, eq(role.systemId, system.id))
    .where(
      and(eq(userRole.userId, userId), eq(role.name, env.ADMIN_ROLE_NAME)),
    );

  if (rows.some((r) => r.slug === env.ADMIN_SYSTEM_SLUG)) return { all: true };
  return {
    all: false,
    systemIds: [...new Set(rows.filter((r) => r.active).map((r) => r.id))],
  };
}

// Con caché en Redis (TTL corto, mismo criterio que middleware/admin.ts). Un
// fallo de Redis nunca bloquea: se cae a la consulta a BD.
export async function getManageScope(userId: string): Promise<ManageScope> {
  if (redis) {
    try {
      const cached = await redisCommand(() =>
        redis!.send("GET", [scopeCacheKey(userId)]),
      );
      if (typeof cached === "string") return JSON.parse(cached) as ManageScope;
    } catch {
      // Redis no disponible o lento (o valor corrupto): seguimos con la BD.
    }
  }

  const scope = await queryManageScope(userId);

  if (redis) {
    try {
      await redisCommand(() =>
        redis!.send("SET", [
          scopeCacheKey(userId),
          JSON.stringify(scope),
          "EX",
          String(SCOPE_CACHE_TTL_SECONDS),
        ]),
      );
    } catch {
      // Si no se puede cachear, no pasa nada: la próxima vez se recalcula.
    }
  }
  return scope;
}

// Tras asignar o quitar un rol admin: el alcance (y el flag de superadmin de
// middleware/admin.ts) deben recalcularse ya, no esperar al TTL.
export async function invalidateManageScope(userId: string) {
  if (!redis) return;
  try {
    await redisCommand(() =>
      redis!.send("DEL", [scopeCacheKey(userId), `admin:${userId}`]),
    );
  } catch {
    // El TTL corto acota el desfase si Redis no responde.
  }
}

// Sistemas gestionables con su nombre, para GET /api/systems/managed y la UI.
export async function listManagedSystems(scope: ManageScope) {
  const rows = await db
    .select({ id: system.id, slug: system.slug, name: system.name })
    .from(system)
    .orderBy(system.name);
  if (scope.all) return rows;
  return rows.filter((s) => scope.systemIds.includes(s.id));
}
