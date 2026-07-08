import type { Context } from "hono";
import { auth } from "./auth.js";

const FORWARDED_HEADERS = ["set-auth-token", "set-auth-jwt", "access-control-expose-headers"];

export function forwardAuthHeaders(c: Context, headers: Headers | undefined) {
  if (!headers) return;
  for (const cookie of headers.getSetCookie?.() ?? []) {
    c.header("Set-Cookie", cookie, { append: true });
  }
  for (const name of FORWARDED_HEADERS) {
    const value = headers.get(name);
    if (value) c.header(name, value);
  }
}

export async function issueJwt(sessionToken: string | null | undefined) {
  if (!sessionToken) return null;
  const { token } = await auth.api.getToken({
    headers: new Headers({ authorization: `Bearer ${sessionToken}` }),
  });
  return token;
}

type ApiError = { statusCode: number; body?: { message?: string; code?: string } };

function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

export function handleAuthError(c: Context, error: unknown) {
  if (isApiError(error)) {
    return c.json(
      { error: error.body?.message ?? "Error de autenticación", code: error.body?.code },
      error.statusCode as any,
    );
  }
  throw error;
}
