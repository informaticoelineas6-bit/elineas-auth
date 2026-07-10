import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { sessionSystem, system } from "@/db/business-schema";
import { session } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { HttpError } from "@/lib/http";

// Resuelve un sistema activo por su slug. Se valida ANTES de crear la sesión,
// para no dejar sesiones colgando sin sistema si el slug es inválido.
export async function resolveActiveSystem(slug: string | undefined) {
  if (!slug) {
    throw new HttpError(400, "Falta el sistema (systemSlug)", "SYSTEM_REQUIRED");
  }
  const [sys] = await db
    .select()
    .from(system)
    .where(and(eq(system.slug, slug), eq(system.active, true)))
    .limit(1);
  if (!sys) {
    throw new HttpError(400, `Sistema "${slug}" no encontrado o inactivo`, "SYSTEM_NOT_FOUND");
  }
  return sys;
}

// Enlaza la sesión recién creada a un sistema garantizando "una sola sesión por
// usuario y sistema": revoca cualquier sesión previa del usuario en ese sistema
// (su enlace se borra en cascada) antes de insertar el nuevo enlace.
export async function bindSessionToSystem(params: {
  sessionToken: string;
  userId: string;
  systemId: string;
}) {
  const { sessionToken, userId, systemId } = params;

  const [current] = await db
    .select({ id: session.id })
    .from(session)
    .where(eq(session.token, sessionToken))
    .limit(1);
  if (!current) {
    throw new HttpError(500, "No se pudo resolver la sesión recién creada", "SESSION_NOT_FOUND");
  }

  const previous = await db
    .select({ token: session.token, sessionId: sessionSystem.sessionId })
    .from(sessionSystem)
    .innerJoin(session, eq(sessionSystem.sessionId, session.id))
    .where(and(eq(sessionSystem.userId, userId), eq(sessionSystem.systemId, systemId)));

  const authHeaders = new Headers({ authorization: `Bearer ${sessionToken}` });
  await Promise.all(
    previous
      .filter((prev) => prev.sessionId !== current.id)
      .map((prev) =>
        auth.api.revokeSession({ body: { token: prev.token }, headers: authHeaders }),
      ),
  );

  await db
    .insert(sessionSystem)
    .values({ sessionId: current.id, userId, systemId })
    .onConflictDoNothing();

  return current.id;
}

// Devuelve el sistema al que está enlazada una sesión, o null si no lo está.
export async function getSessionSystem(sessionId: string) {
  const [row] = await db
    .select({
      id: system.id,
      name: system.name,
      slug: system.slug,
      description: system.description,
      active: system.active,
      createdAt: system.createdAt,
      updatedAt: system.updatedAt,
    })
    .from(sessionSystem)
    .innerJoin(system, eq(sessionSystem.systemId, system.id))
    .where(eq(sessionSystem.sessionId, sessionId))
    .limit(1);
  return row ?? null;
}
