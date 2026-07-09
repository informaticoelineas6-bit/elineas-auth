import { auth } from "@/lib/auth";
import { forwardAuthHeaders, handleAuthError } from "@/lib/http";
import type { AppEnv } from "@/types/hono-env";
import { RevokeOneParamsInput } from "@/types/session";
import { Context } from "hono";

export const getSessionFn = async (c: Context) => {
  return c.json({ user: c.get("user"), session: c.get("session") }, 200);
};

export const listSessionsFn = async (c: Context) => {
  try {
    const sessions = await auth.api.listSessions({
      headers: c.req.raw.headers,
    });
    return c.json({ sessions }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const revokeOthersFn = async (c: Context) => {
  try {
    const { headers, response } = await auth.api.revokeOtherSessions({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const revokeAllFn = async (c: Context) => {
  try {
    const { headers, response } = await auth.api.revokeSessions({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const revokeOneFn = async (
  c: Context<AppEnv, string, RevokeOneParamsInput>,
) => {
  try {
    const { token } = c.req.valid("param");
    const { headers, response } = await auth.api.revokeSession({
      body: { token },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};
