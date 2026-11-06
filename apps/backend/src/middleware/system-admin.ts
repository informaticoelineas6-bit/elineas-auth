import {
  getManageScope,
  isScopeEmpty,
} from "@backend/services/system-admin.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import type { Context, Next } from "hono";

// Exige que el usuario administre al menos un sistema (superadmin, o rol admin
// en algún sistema activo) y deja su alcance en `c.get("manageScope")` para
// que cada handler acote el recurso concreto con assertCanManageSystem /
// scopeFilter. Debe ejecutarse DESPUÉS de requireSession o requireIdentity.
export async function requireSystemManager(c: Context<AppEnv>, next: Next) {
  const user = c.get("user");
  if (!user) return c.json({ error: "No autorizado" }, 401);

  const scope = await getManageScope(user.id);
  if (isScopeEmpty(scope)) {
    return c.json(
      {
        error: "Requiere administrar al menos un sistema",
        code: "FORBIDDEN",
      },
      403,
    );
  }

  c.set("manageScope", scope);
  // Queda en el wide event: qué alcance amparó esta petición de administración.
  c.get("log")?.set({
    authz: scope.all
      ? { superAdmin: true }
      : { superAdmin: false, systemIds: scope.systemIds },
  });
  await next();
}
