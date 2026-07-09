import { auth } from "@/lib/auth";
import { forwardAuthHeaders, handleError, issueJwt } from "@/lib/http";
import {
  bindSessionToSystem,
  resolveActiveSystem,
} from "@/services/session-system.service";
import { Context } from "hono";

export const signUpFn = async (c: Context) => {
  try {
    // systemSlug es opcional en el registro (permite crear el primer admin
    // antes de que exista ningún sistema).
    const { systemSlug, ...credentials } = await c.req.json();
    const sys = systemSlug ? await resolveActiveSystem(systemSlug) : null;
    const { headers, response } = await auth.api.signUpEmail({
      body: credentials,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    if (sys && response.token) {
      await bindSessionToSystem({
        sessionToken: response.token,
        userId: response.user.id,
        systemId: sys.id,
      });
    }
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token, system: sys }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

export const signInFn = async (c: Context) => {
  try {
    // systemSlug es obligatorio: cada login pertenece a un sistema concreto.
    const { systemSlug, ...credentials } = await c.req.json();
    const sys = await resolveActiveSystem(systemSlug);
    const { headers, response } = await auth.api.signInEmail({
      body: credentials,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    await bindSessionToSystem({
      sessionToken: response.token,
      userId: response.user.id,
      systemId: sys.id,
    });
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token, system: sys }, 200);
  } catch (error) {
    return handleError(error, c);
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
    return handleError(error, c);
  }
};

export const getTokenFn = async (c: Context) => {
  try {
    const { token } = await auth.api.getToken({ headers: c.req.raw.headers });
    return c.json({ token }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

export const getJwksFn = async (c: Context) => {
  const jwks = await auth.api.getJwks();
  return c.json(jwks, 200);
};
