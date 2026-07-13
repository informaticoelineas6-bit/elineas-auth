import { auth } from "@/lib/auth";
import { forwardAuthHeaders, handleAuthError, HttpError } from "@/lib/http";
import { getSessionSystem } from "@/services/session-system.service";
import type { AppEnv } from "@/types/hono-env";
import { RevokeOneBodyInput } from "@/types/session";
import { Context } from "hono";

// El token es un secreto de portador: nunca se devuelve al cliente. Se elimina
// del objeto de sesión antes de responder para que un XSS no pueda leerlo y
// secuestrar la sesión.
function stripToken<T extends { token: string }>(session: T): Omit<T, "token"> {
  const { token: _token, ...safe } = session;
  return safe;
}

export const getSessionFn = async (c: Context<AppEnv>) => {
  const session = c.get("session");
  const system = await getSessionSystem(session.id);
  return c.json({ user: c.get("user"), session: stripToken(session), system }, 200);
};

export const listSessionsFn = async (c: Context<AppEnv>) => {
  try {
    const sessions = await auth.api.listSessions({
      headers: c.req.raw.headers,
    });
    return c.json({ sessions: sessions.map(stripToken) }, 200);
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
  c: Context<AppEnv, string, RevokeOneBodyInput>,
) => {
  try {
    const { sessionId } = c.req.valid("json");

    // listSessions solo devuelve las sesiones del usuario autenticado, por lo
    // que buscar el id aquí garantiza que solo se pueda revocar una sesión
    // propia (no se puede pasar el id de otro usuario). El token se resuelve en
    // el servidor y nunca sale al cliente.
    const sessions = await auth.api.listSessions({ headers: c.req.raw.headers });
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) {
      throw new HttpError(404, "Sesión no encontrada", "NOT_FOUND");
    }

    const { headers, response } = await auth.api.revokeSession({
      body: { token: target.token },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};
