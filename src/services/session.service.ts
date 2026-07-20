import { and, count, desc, eq, gt, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { session, user } from "@/db/auth-schema";
import { forwardAuthHeaders, handleAuthError, HttpError } from "@/lib/http";
import { escapeLike } from "@/lib/search";
import { toOffset, type PaginationInput } from "@/lib/pagination";
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

// --- Listado administrativo (todas las sesiones, de todos los usuarios) ----
// A diferencia de lo anterior, esto NO pasa por `auth.api.listSessions`
// (better-auth la acota siempre al usuario autenticado): consulta la tabla
// `session` directamente con un JOIN a `user`, protegido por `requireAdmin` en
// la ruta. Igual que `listSessionsFn`, se excluyen las sesiones ya expiradas.
export async function listAllSessions(
  filters: { search?: string },
  pagination: PaginationInput,
) {
  const conditions = [
    gt(session.expiresAt, new Date()),
    filters.search
      ? (() => {
          const term = `%${escapeLike(filters.search)}%`;
          return or(ilike(user.name, term), ilike(user.email, term));
        })()
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        user: { id: user.id, name: user.name, email: user.email },
      })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(where)
      .orderBy(desc(session.createdAt))
      .limit(pagination.limit)
      .offset(toOffset(pagination)),
    db
      .select({ total: count() })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(where),
  ]);

  return { rows, total };
}

// Revoca por id la sesión de CUALQUIER usuario (a diferencia de `revokeOneFn`,
// que solo permite revocar una sesión propia). Se borra la fila directamente:
// `auth.api.revokeSession` de better-auth exige que la sesión pertenezca al
// usuario autenticado, así que no sirve para revocar la de otro.
export async function adminRevokeSession(sessionId: string) {
  const [target] = await db
    .select({ id: session.id })
    .from(session)
    .where(eq(session.id, sessionId))
    .limit(1);
  if (!target) {
    throw new HttpError(404, "Sesión no encontrada", "NOT_FOUND");
  }
  await db.delete(session).where(eq(session.id, sessionId));
}
