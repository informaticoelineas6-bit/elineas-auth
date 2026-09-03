import { account, session, user } from "@backend/db/auth-schema.ts";
import { db } from "@backend/db/index.ts";
import { auth } from "@backend/lib/auth.ts";
import {
  forwardAuthHeaders,
  HttpError,
  handleAuthError,
} from "@backend/lib/http.ts";
import type {
  ChangeEmailBodySchema,
  ChangePasswordBodySchema,
  UpdateUserBodySchema,
} from "@backend/openapi/schemas.ts";
import type { z } from "@hono/zod-openapi";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";

// Verifica que `password` coincida con la contraseña actual del usuario. Lee el
// hash del account de credenciales (providerId "credential", el que usa el login
// email/password) y lo compara con verifyPassword de better-auth. Lanza 401 si
// no coincide o si el usuario no tiene contraseña local (p. ej. solo social).
async function assertCurrentPassword(userId: string, password: string) {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential")),
    )
    .limit(1);
  if (
    !row?.password ||
    !(await verifyPassword({ hash: row.password, password }))
  ) {
    throw new HttpError(
      401,
      "Contraseña actual incorrecta",
      "INVALID_PASSWORD",
    );
  }
}

type UpdateUserInput = { out: { json: z.infer<typeof UpdateUserBodySchema> } };
type ChangePasswordInput = {
  out: { json: z.infer<typeof ChangePasswordBodySchema> };
};
type ChangeEmailInput = {
  out: { json: z.infer<typeof ChangeEmailBodySchema> };
};

export const getMeFn = async (c: Context) => {
  return c.json({ user: c.get("user") }, 200);
};

export const updateMeFn = async (c: Context<any, string, UpdateUserInput>) => {
  try {
    // Body ya validado por Zod: solo name/image, sin campos desconocidos que
    // pudieran reenviarse a auth.api.updateUser.
    const body = c.req.valid("json");
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

export const changePasswordFn = async (
  c: Context<any, string, ChangePasswordInput>,
) => {
  try {
    const body = c.req.valid("json");
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

export const changeEmailFn = async (
  c: Context<any, string, ChangeEmailInput>,
) => {
  try {
    const { currentPassword, ...body } = c.req.valid("json");
    // Re-autenticación antes de un cambio sensible: sin esto, una sesión robada
    // bastaría para iniciar la apropiación de la cuenta cambiando el email.
    await assertCurrentPassword(c.get("user").id, currentPassword);
    const { headers, response } = await auth.api.changeEmail({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    // Con verificación activada (ver lib/auth.ts) el cambio no se aplica aquí:
    // better-auth ha enviado un enlace al nuevo correo y solo devuelve
    // `{ status }`. Se expone `pendingVerification: true` para que el frontend
    // muestre "revisa tu bandeja" sin depender del cuerpo de better-auth.
    return c.json(
      { status: response.status ?? true, pendingVerification: true },
      200,
    );
  } catch (error) {
    return handleAuthError(c, error);
  }
};

// Cambia la contraseña de OTRO usuario. La ejecuta un admin desde el panel
// (rutas `usersAdminRoutes`, protegidas por requireSession + requireAdmin).
//
// No se puede delegar en `auth.api.changePassword` ni en `auth.api.setPassword`:
// las dos operan sobre el usuario de la sesión y exigen su contraseña actual,
// que el admin no conoce. `auth.api.resetPassword` exige un token del flujo por
// correo. El plugin `admin()` de better-auth sí expone `setUserPassword`, pero
// trae consigo su propio concepto de admin (columna `role`, baneos) que
// competiría con el sistema de roles por sistema que ya tiene este IS.
//
// Así que se replica lo que hace better-auth en su propio reseteo: hash de la
// nueva contraseña, UPDATE del account de credenciales y borrado de las
// sesiones. El hash se calcula con `hashPassword` de better-auth/crypto, la
// misma función que usa por defecto; si algún día se configurase un hasher
// propio en `emailAndPassword.password`, habría que cambiarlo aquí y en
// `assertCurrentPassword` a la vez (las dos dependen del hasher por defecto).
export async function adminChangeUserPassword(input: {
  /** Admin que ejecuta la acción; se re-autentica con su propia contraseña. */
  adminUserId: string;
  targetUserId: string;
  newPassword: string;
  currentPassword: string;
  revokeSessions: boolean;
}): Promise<{ revokedSessions: number }> {
  // Primero la re-autenticación: si falla, no se ha tocado nada.
  await assertCurrentPassword(input.adminUserId, input.currentPassword);

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, input.targetUserId))
    .limit(1);
  if (!target) {
    throw new HttpError(404, "Usuario no encontrado", "NOT_FOUND");
  }

  const hashed = await hashPassword(input.newPassword);

  // Se comprueba cuántas filas se actualizaron: si el usuario no tiene account
  // de credenciales, el UPDATE no afecta a ninguna y la contraseña NO se habría
  // cambiado. Sin esta comprobación la operación respondería 200 sin haber
  // hecho nada.
  const updated = await db
    .update(account)
    .set({ password: hashed })
    .where(
      and(
        eq(account.userId, input.targetUserId),
        eq(account.providerId, "credential"),
      ),
    )
    .returning({ id: account.id });

  if (updated.length === 0) {
    throw new HttpError(
      409,
      "El usuario no tiene contraseña local, así que no se puede cambiar",
      "NO_CREDENTIAL_ACCOUNT",
    );
  }

  if (!input.revokeSessions) return { revokedSessions: 0 };

  // Se borran TODAS las sesiones del usuario objetivo, incluida la actual si el
  // admin se la está cambiando a sí mismo (en ese caso queda desconectado, que
  // es el comportamiento coherente con haber pedido revocar).
  const revoked = await db
    .delete(session)
    .where(eq(session.userId, input.targetUserId))
    .returning({ id: session.id });

  return { revokedSessions: revoked.length };
}
