import { auth } from "@/lib/auth";
import { forwardAuthHeaders, handleAuthError } from "@/lib/http";
import { Context } from "hono";

export const getMeFn = async (c: Context) => {
  return c.json({ user: c.get("user") }, 200);
};

export const updateMeFn = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.updateUser({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const changePasswordFn = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.changePassword({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const changeEmailFn = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.changeEmail({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};

export const deleteMeFn = async (c: Context) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { headers, response } = await auth.api.deleteUser({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};
