import { randomBytes } from "node:crypto";
import { auth } from "@backend/lib/auth.ts";

// Contraseña inicial de una cuenta invitada: aleatoria, de 256 bits y que nadie
// llega a ver. Existe solo porque better-auth exige una al crear el usuario; el
// dueño la sustituye con el enlace de invitación. Cumple la política (12-128,
// mayúscula, minúscula, número y especial) por si algún día se valida.
export function generateInitialPassword(): string {
  return `Aa1!${randomBytes(32).toString("base64url")}`;
}

// Envía (o reenvía) el enlace de un solo uso para establecer la contraseña.
// better-auth genera el token y llama a `sendResetPassword` (ver lib/auth.ts).
// Nunca lanza: un fallo de correo no debe abortar un alta ya completada; se
// registra y el admin puede reenviar la invitación.
export async function sendAccountInvite(email: string): Promise<void> {
  try {
    await auth.api.requestPasswordReset({ body: { email } });
  } catch (error) {
    console.error(
      `No se pudo enviar la invitación a ${email}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
