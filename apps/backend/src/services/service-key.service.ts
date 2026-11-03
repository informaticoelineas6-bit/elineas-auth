import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@backend/db/index.ts";
import { system, systemServiceKey } from "@backend/db/business-schema.ts";
import { HttpError } from "@backend/lib/http.ts";

const PREFIX = "elsk_";

const hash = (key: string) => createHash("sha256").update(key).digest();

// Genera (o rota) la clave del sistema. Devuelve la clave en claro UNA sola vez;
// en BD solo queda su hash. Rotar invalida la anterior.
export async function rotateServiceKey(systemId: string) {
  const [sys] = await db
    .select({ id: system.id })
    .from(system)
    .where(eq(system.id, systemId))
    .limit(1);
  if (!sys) throw new HttpError(404, "Sistema no encontrado", "NOT_FOUND");

  const key = PREFIX + randomBytes(32).toString("base64url");
  const keyHash = hash(key).toString("hex");
  const [row] = await db
    .insert(systemServiceKey)
    .values({ systemId, keyHash })
    .onConflictDoUpdate({
      target: systemServiceKey.systemId,
      set: { keyHash, createdAt: new Date() },
    })
    .returning({ createdAt: systemServiceKey.createdAt });
  return { key, createdAt: row.createdAt };
}

export async function revokeServiceKey(systemId: string) {
  const [row] = await db
    .delete(systemServiceKey)
    .where(eq(systemServiceKey.systemId, systemId))
    .returning({ systemId: systemServiceKey.systemId });
  if (!row) throw new HttpError(404, "El sistema no tiene clave de servicio", "NOT_FOUND");
}

export async function getServiceKeyStatus(systemId: string) {
  const [row] = await db
    .select({ createdAt: systemServiceKey.createdAt })
    .from(systemServiceKey)
    .where(eq(systemServiceKey.systemId, systemId))
    .limit(1);
  return { hasKey: !!row, createdAt: row?.createdAt ?? null };
}

// ¿Es `key` la clave vigente del sistema activo con ese slug?
export async function verifyServiceKey(slug: string, key: string) {
  const [row] = await db
    .select({ keyHash: systemServiceKey.keyHash })
    .from(system)
    .innerJoin(systemServiceKey, eq(systemServiceKey.systemId, system.id))
    .where(and(eq(system.slug, slug), eq(system.active, true)))
    .limit(1);
  if (!row) return false;
  const expected = Buffer.from(row.keyHash, "hex");
  return timingSafeEqual(expected, hash(key));
}
