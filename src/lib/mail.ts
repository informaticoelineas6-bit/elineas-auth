import nodemailer from "nodemailer";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { env } from "@/config/env";
import { WelcomeEmail } from "@/emails/welcome-email";
import { ChangeEmailVerification } from "@/emails/change-email-verification";

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

// Fire-and-forget: NUNCA lanza. Un fallo de envío no debe abortar un alta que
// ya se completó, así que el error se loguea y la operación de negocio sigue.
// Los call sites invocan `void sendWelcomeEmail(...)` sin await ni catch.
export async function sendWelcomeEmail(input: {
  to: string;
  name: string;
  password: string;
}) {
  if (!send) return;
  try {
    const element = WelcomeEmail({
      name: input.name,
      email: input.to,
      password: input.password,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    await send({
      to: input.to,
      subject: "Bienvenido a Mercado Elineas: tus credenciales de acceso",
      html,
      text,
    });
  } catch (error) {
    console.error(
      `No se pudo enviar el correo de bienvenida a ${input.to}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

// Correo de confirmación del cambio de email. A diferencia de sendWelcomeEmail
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
