import type { Context, Next } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { role, system, userRole } from "@/db/business-schema";
import { env } from "@/config/env";
import type { AppEnv } from "@/types/hono-env";

// Exige que el usuario autenticado tenga el rol admin dentro del sistema que
// representa a este identity server (env.ADMIN_SYSTEM_SLUG / ADMIN_ROLE_NAME).
// Debe ejecutarse DESPUÉS de requireSession (que puebla c.get("user")).
export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const user = c.get("user");
  if (!user) return c.json({ error: "No autorizado" }, 401);

  const [row] = await db
    .select({ id: userRole.id })
    .from(userRole)
    .innerJoin(role, eq(userRole.roleId, role.id))
    .innerJoin(system, eq(role.systemId, system.id))
    .where(
      and(
        eq(userRole.userId, user.id),
        eq(role.name, env.ADMIN_ROLE_NAME),
        eq(system.slug, env.ADMIN_SYSTEM_SLUG),
      ),
    )
    .limit(1);

  if (!row) {
    return c.json(
      { error: "Requiere privilegios de administrador", code: "FORBIDDEN" },
      403,
    );
  }
  await next();
}
