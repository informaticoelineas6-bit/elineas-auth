import { and, eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { account } from "@/db/auth-schema";
import { forwardAuthHeaders, handleAuthError, HttpError } from "@/lib/http";
import type { z } from "@hono/zod-openapi";
import type {
  ChangeEmailBodySchema,
  ChangePasswordBodySchema,
  UpdateUserBodySchema,
} from "@/openapi/schemas";
import { Context } from "hono";

// Verifica que `password` coincida con la contraseña actual del usuario. Lee el
// hash del account de credenciales (providerId "credential", el que usa el login
// email/password) y lo compara con verifyPassword de better-auth. Lanza 401 si
// no coincide o si el usuario no tiene contraseña local (p. ej. solo social).
async function assertCurrentPassword(userId: string, password: string) {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);
  if (!row?.password || !(await verifyPassword({ hash: row.password, password }))) {
    throw new HttpError(401, "Contraseña actual incorrecta", "INVALID_PASSWORD");
  }
}

type UpdateUserInput = { out: { json: z.infer<typeof UpdateUserBodySchema> } };
type ChangePasswordInput = {
  out: { json: z.infer<typeof ChangePasswordBodySchema> };
};
type ChangeEmailInput = { out: { json: z.infer<typeof ChangeEmailBodySchema> } };

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
    return c.json({ status: response.status ?? true, pendingVerification: true }, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
};
