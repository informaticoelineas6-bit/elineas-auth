import { auth } from "@/lib/auth";
import { forwardAuthHeaders, handleAuthError, issueJwt } from "@/lib/http";
import { Context } from "hono";

export const signUpFn = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.signUpEmail({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const signInFn = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.signInEmail({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const signOutFn = async (c: Context) => {
  try {
    const { headers, response } = await auth.api.signOut({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const getTokenFn = async (c: Context) => {
  try {
    const { token } = await auth.api.getToken({ headers: c.req.raw.headers });
    return c.json({ token }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const getJwksFn = async (c: Context) => {
  const jwks = await auth.api.getJwks();
  return c.json(jwks, 200);
};
