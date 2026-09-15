import { user } from "@backend/db/auth-schema.ts";
import { tkcKey, userTkcKey } from "@backend/db/business-schema.ts";
import { db } from "@backend/db/index.ts";
import { HttpError } from "@backend/lib/http.ts";
import {
  isSecretBoxConfigured,
  openSecret,
  sealSecret,
  secretsEqual,
} from "@backend/lib/secret-box.ts";
import { eq } from "drizzle-orm";

export type TkcCredentials = { username: string; password: string };

/** Vista SIN contraseña de la credencial enlazada, para la administración. */
export type TkcKeySummary = {
  id: string;
  username: string;
  linkedAt: Date;
  updatedAt: Date;
};

// Una credencial de TKC es una identidad en un sistema EXTERNO y pertenece a
// UNA sola persona: dos usuarios del IS no pueden declarar el mismo usuario de
// TKC. La regla se apoya en dos UNIQUE de la BD —`tkc_key.username` y
// `user_tkc_key.tkcKeyId`—, y aquí se comprueba antes para devolver un 409 con
// un mensaje que dice qué pasa, en vez del error genérico de unicidad que
// produciría chocar contra la restricción.
//
// La comprobación previa no sustituye a la restricción: dos altas simultáneas
// con el mismo usuario de TKC pasarían las dos comprobaciones y solo Postgres
// puede rechazar la segunda. Ese caso cae en el 409 genérico de `handleError`,
// que es correcto aunque menos explícito; es una carrera rara y el resultado
// —no se guarda el duplicado— es el mismo.

// `.returning()` devuelve siempre una fila en un INSERT/UPDATE que afectó a
// una, pero el tipo es un array: sin esta comprobación habría que afirmar con
// `!` que existe, y un día en que no exista el fallo sería un TypeError opaco
// en vez de un error con contexto.
function requireRow<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new HttpError(500, `No se pudo guardar ${what}`, "TKC_WRITE_FAILED");
  }
  return row;
}

function requireSecretBox() {
  if (isSecretBoxConfigured()) return;
  throw new HttpError(
    503,
    "Las credenciales de TKC no están disponibles: falta configurar " +
      "TKC_SECRET_KEY en el servidor",
    "TKC_NOT_CONFIGURED",
  );
}

/**
 * Fija (crea o reemplaza) las credenciales de TKC de un usuario.
 *
 * Lanza 409 si ese usuario de TKC ya está enlazado a otra persona: una cuenta
 * del sistema externo pertenece a una sola.
 *
 * Todo ocurre en una transacción porque son hasta tres escrituras acopladas
 * —crear/actualizar la credencial, mover el vínculo y borrar la credencial que
 * queda huérfana— y a medias dejarían al usuario enlazado a una cuenta que ya
 * no es la suya.
 */
export async function setUserTkcCredentials(
  userId: string,
  input: TkcCredentials,
): Promise<TkcKeySummary> {
  requireSecretBox();

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!target) {
      throw new HttpError(404, "Usuario no encontrado", "NOT_FOUND");
    }

    // La credencial se busca por `username` junto con su dueño actual (LEFT
    // JOIN: puede no tener ninguno si un borrado anterior dejó la fila suelta).
    const [existingKey] = await tx
      .select({
        id: tkcKey.id,
        password: tkcKey.password,
        ownerId: userTkcKey.userId,
      })
      .from(tkcKey)
      .leftJoin(userTkcKey, eq(userTkcKey.tkcKeyId, tkcKey.id))
      .where(eq(tkcKey.username, input.username))
      .limit(1);

    let keyId: string;
    if (existingKey) {
      // Ese usuario de TKC ya es de otra persona. Se rechaza sin tocar nada:
      // reasignarlo dejaría a dos cuentas del IS compartiendo una identidad del
      // sistema externo, y a la primera sin credenciales sin previo aviso.
      if (existingKey.ownerId !== null && existingKey.ownerId !== userId) {
        throw new HttpError(
          409,
          `El usuario de TKC "${input.username}" ya está enlazado a otro usuario`,
          "TKC_USERNAME_TAKEN",
        );
      }
      keyId = existingKey.id;
      // Se descifra solo para no reescribir (ni tocar `updated_at`) cuando la
      // contraseña no cambió. Si la fila viniera cifrada con otra clave, el
      // descifrado falla: se trata como "cambió" y se reescribe, que es
      // justamente lo que recupera esa fila.
      let unchanged = false;
      try {
        unchanged = secretsEqual(
          openSecret(existingKey.password),
          input.password,
        );
      } catch {
        unchanged = false;
      }
      if (!unchanged) {
        await tx
          .update(tkcKey)
          .set({ password: sealSecret(input.password) })
          .where(eq(tkcKey.id, keyId));
      }
    } else {
      const [created] = await tx
        .insert(tkcKey)
        .values({
          username: input.username,
          password: sealSecret(input.password),
        })
        .returning({ id: tkcKey.id });
      keyId = requireRow(created, "la credencial de TKC").id;
    }

    const [currentLink] = await tx
      .select({ id: userTkcKey.id, tkcKeyId: userTkcKey.tkcKeyId })
      .from(userTkcKey)
      .where(eq(userTkcKey.userId, userId))
      .limit(1);

    let link: { createdAt: Date; updatedAt: Date };
    if (currentLink) {
      const [updated] = await tx
        .update(userTkcKey)
        .set({ tkcKeyId: keyId })
        .where(eq(userTkcKey.id, currentLink.id))
        .returning({
          createdAt: userTkcKey.createdAt,
          updatedAt: userTkcKey.updatedAt,
        });
      link = requireRow(updated, "el vínculo con la credencial de TKC");
      // La credencial anterior se borra: al ser la relación 1 a 1, mover el
      // vínculo la deja sin dueño posible. Si no se borrara, cada corrección de
      // un usuario de TKC mal tecleado dejaría para siempre una fila con una
      // contraseña cifrada que nadie puede consultar ni limpiar — y, peor, su
      // `username` seguiría ocupado, bloqueando a quien lo necesitara de verdad.
      if (currentLink.tkcKeyId !== keyId) {
        await tx.delete(tkcKey).where(eq(tkcKey.id, currentLink.tkcKeyId));
      }
    } else {
      const [created] = await tx
        .insert(userTkcKey)
        .values({ userId, tkcKeyId: keyId })
        .returning({
          createdAt: userTkcKey.createdAt,
          updatedAt: userTkcKey.updatedAt,
        });
      link = requireRow(created, "el vínculo con la credencial de TKC");
    }

    return {
      id: keyId,
      username: input.username,
      linkedAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  });
}

/**
 * Desvincula las credenciales de TKC de un usuario. Devuelve false si no tenía
 * ninguna (el llamante decide si eso es un 404 o un no-op).
 */
export async function removeUserTkcCredentials(
  userId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(userTkcKey)
      .where(eq(userTkcKey.userId, userId))
      .returning({ tkcKeyId: userTkcKey.tkcKeyId });
    if (!removed) return false;
    // Borrado incondicional: la credencial era de este usuario y de nadie más
    // (UNIQUE sobre `tkcKeyId`), así que al quitar el vínculo queda huérfana.
    // Dejarla mantendría su `username` ocupado y bloquearía enlazar esa misma
    // cuenta de TKC a otra persona, que es justo lo que se suele querer hacer
    // después de desvincularla.
    await tx.delete(tkcKey).where(eq(tkcKey.id, removed.tkcKeyId));
    return true;
  });
}

/**
 * Credencial enlazada SIN la contraseña. Es lo único que devuelven las rutas de
 * administración: un admin necesita saber qué usuario de TKC tiene asignado
 * cada persona y poder reemplazarlo, pero no leer su contraseña. Así, la
 * contraseña solo sale del servidor por un camino —el login de su propio
 * dueño— en vez de estar al alcance de cualquier sesión de admin.
 */
export async function getUserTkcKeySummary(
  userId: string,
): Promise<TkcKeySummary | null> {
  const [row] = await db
    .select({
      id: tkcKey.id,
      username: tkcKey.username,
      linkedAt: userTkcKey.createdAt,
      updatedAt: userTkcKey.updatedAt,
    })
    .from(userTkcKey)
    .innerJoin(tkcKey, eq(userTkcKey.tkcKeyId, tkcKey.id))
    .where(eq(userTkcKey.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Credenciales en claro de un usuario, para entregárselas al iniciar sesión.
 *
 * NUNCA lanza: un fallo aquí (clave de cifrado ausente, rotada o fila alterada)
 * no puede impedir el login, que es una función independiente de TKC. Se
 * registra y se devuelve null; el cliente ve que no hay credenciales TKC y el
 * resto de la sesión funciona igual.
 */
export async function getUserTkcCredentials(
  userId: string,
): Promise<TkcCredentials | null> {
  try {
    const [row] = await db
      .select({ username: tkcKey.username, password: tkcKey.password })
      .from(userTkcKey)
      .innerJoin(tkcKey, eq(userTkcKey.tkcKeyId, tkcKey.id))
      .where(eq(userTkcKey.userId, userId))
      .limit(1);
    if (!row) return null;
    return { username: row.username, password: openSecret(row.password) };
  } catch (error) {
    // Sin el valor ni el usuario en el mensaje: este log acaba en el mismo
    // sitio que el resto y no debe convertirse en una filtración.
    console.error(
      "No se pudieron resolver las credenciales de TKC para el login:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

// Se exporta para el alta combinada (usuario + empleado + TKC), que necesita
// distinguir "el usuario no existe todavía" de un fallo real antes de crear
// nada. Comprueba que la credencial se puede guardar SIN escribir.
export function assertTkcCredentialsUsable() {
  requireSecretBox();
}

// Reexportado por comodidad de los llamantes que solo comprueban el estado.
export { isSecretBoxConfigured };
