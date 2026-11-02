import { randomBytes } from "node:crypto";
import { auth } from "@backend/lib/auth.ts";

// Contraseña inicial de una cuenta invitada: aleatoria, de 256 bits y que nadie
// llega a ver. Existe solo porque better-auth exige una al crear el usuario; el
// dueño la sustituye con el enlace de invitación. Cumple la política (12-128,
// mayúscula, minúscula, número y especial) por si algún día se valida.
export function generateInitialPassword(): string {
  return `Aa1!${randomBytes(32).toString("base64url")}`;
}

// Cola de invitaciones en memoria: un envío a la vez con una pausa entre
// correos, para que un alta masiva (p. ej. importar decenas de usuarios) no
// sature el proveedor SMTP ni el proceso. Si el proceso se reinicia, los
// pendientes se pierden; se pueden reenviar con `resendUserInvite`.
const INVITE_GAP_MS = 1500;
let inviteQueue: Promise<void> = Promise.resolve();

export function enqueueAccountInvite(email: string): void {
  inviteQueue = inviteQueue
    .then(() => sendAccountInvite(email))
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, INVITE_GAP_MS)));
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
