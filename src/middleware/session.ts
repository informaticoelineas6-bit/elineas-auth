import type { Context, Next } from "hono";
import { auth } from "../lib/auth.js";
import type { AppEnv } from "../types/hono-env.js";

export async function requireSession(c: Context<AppEnv>, next: Next) {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) {
    return c.json({ error: "No autorizado" }, 401);
  }
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
}
