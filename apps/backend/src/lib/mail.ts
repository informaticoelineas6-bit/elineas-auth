import nodemailer from "nodemailer";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { env } from "@backend/config/env.ts";
import { InviteEmail } from "@backend/emails/invite-email.tsx";
import { ChangeEmailVerification } from "@backend/emails/change-email-verification.tsx";

type SendArgs = { to: string; subject: string; html: string; text: string };

// Transporte elegido por configuración, no por APP_ENV (mismo patrón que
// REDIS_URL): Resend si hay API key; SMTP (maildev en desarrollo) si hay
// SMTP_HOST; null = mailer deshabilitado (se avisa una vez al arrancar y los
// envíos se omiten en silencio).
let send: ((args: SendArgs) => Promise<void>) | null = null;

if (env.RESEND_API_KEY) {
  const resend = new Resend(env.RESEND_API_KEY);
  send = async (args) => {
    // El SDK de Resend no lanza: devuelve { data, error }. Se convierte en
    // throw para que el catch del llamador lo loguee como cualquier otro fallo.
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, ...args });
    if (error) throw new Error(`${error.name}: ${error.message}`);
  };
} else if (env.SMTP_HOST) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // maildev habla SMTP plano; para un SMTP real con STARTTLS, nodemailer lo
    // negocia automáticamente si el servidor lo anuncia.
    secure: false,
    // Sin esto, un SMTP caído deja el socket colgado 2 minutos (default de
    // nodemailer) por cada envío antes de loguear el fallo.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  send = async (args) => {
    await transporter.sendMail({ from: env.EMAIL_FROM, ...args });
  };
} else {
  console.warn(
    "Mailer deshabilitado: define RESEND_API_KEY o SMTP_HOST para enviar correos.",
  );
}

// Invitación para establecer la contraseña. NUNCA lleva una contraseña: solo un
// enlace de un solo uso (48 h). Sin mailer el enlace no llega a nadie y la cuenta
// queda inaccesible hasta reenviarlo, así que un fallo SÍ se propaga; los
// llamadores que no quieren abortar el alta lo capturan (ver lib/invite.ts).
export async function sendInviteEmail(input: {
  to: string;
  name: string;
  url: string;
}) {
  if (!send) {
    throw new Error(
      "Mailer deshabilitado: no se puede enviar la invitación de la cuenta.",
    );
  }
  const element = InviteEmail({ name: input.name, url: input.url });
  const html = await render(element);
  const text = await render(element, { plainText: true });
  await send({
    to: input.to,
    subject: "Activa tu cuenta de Mercado Elineas",
    html,
    text,
  });
}

// Correo de confirmación del cambio de email. A diferencia del alta (sendAccountInvite)
// (fire-and-forget), aquí el correo ES el camino crítico: sin él el usuario no
// puede completar el cambio, así que un fallo (o el mailer deshabilitado) SÍ se
// propaga para que la solicitud de cambio devuelva un error en vez de decir
// "revisa tu bandeja" cuando en realidad no se envió nada.
export async function sendChangeEmailVerification(input: {
  to: string;
  url: string;
}) {
  if (!send) {
    throw new Error(
      "Mailer deshabilitado: no se puede enviar la verificación de cambio de correo.",
    );
  }
  const element = ChangeEmailVerification({ url: input.url });
  const html = await render(element);
  const text = await render(element, { plainText: true });
  await send({
    to: input.to,
    subject: "Confirma tu nuevo correo en Mercado Elineas",
    html,
    text,
  });
}
