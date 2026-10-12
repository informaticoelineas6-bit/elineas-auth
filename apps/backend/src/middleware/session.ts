import type { Context, Next } from "hono";
import { auth } from "@backend/lib/auth.ts";
import { isUserDeactivated } from "@backend/lib/user-active.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";

export async function requireSession(c: Context<AppEnv>, next: Next) {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) {
    return c.json({ error: "No autorizado" }, 401);
  }
  if (await isUserDeactivated(result.user.id)) {
    return c.json({ error: "La cuenta está desactivada" }, 403);
  }
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
}
