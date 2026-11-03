import type { Context, Next } from "hono";
import { env } from "@backend/config/env.ts";
import { clientIp } from "@backend/lib/client-ip.ts";
import { verifyServiceKey } from "@backend/services/service-key.service.ts";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Captcha (Cloudflare Turnstile) en el login. Se verifica AQUÍ y no solo en el
// frontend: la API es alcanzable directamente, así que un captcha que solo
// valida el panel se puede saltar llamando a POST /api/auth/sign-in. El panel
// reenvía el token del widget en la cabecera `X-Turnstile-Token`.
//
// Sin TURNSTILE_SECRET_KEY (solo permitido fuera de producción, ver env.ts) el
// middleware no hace nada. Falla cerrado: token ausente, rechazado o Cloudflare
// inalcanzable => 403. Los tokens son de un solo uso, por eso solo debe
// verificarse una vez (aquí; el panel ya no lo verifica por su cuenta).
//
// Clientes sin navegador (backends, Postman) no pueden generar el token: usan la
// clave de servicio de su sistema en `X-Service-Key` junto con `systemSlug` en
// el cuerpo, y eso sustituye al captcha. Si la cabecera viene, se valida SOLO la
// clave (no hay vuelta atrás al captcha): clave incorrecta => 403
// SERVICE_KEY_INVALID. Funciona aunque no haya TURNSTILE_SECRET_KEY.
export async function requireTurnstile(c: Context, next: Next) {
  const serviceKey = c.req.header("x-service-key");
  if (serviceKey) {
    let slug: unknown;
    try {
      slug = ((await c.req.json()) as { systemSlug?: unknown }).systemSlug;
    } catch {
      slug = undefined;
    }
    const ok = typeof slug === "string" && (await verifyServiceKey(slug, serviceKey));
    if (!ok) {
      return c.json(
        { error: "Clave de servicio inválida para el sistema indicado.", code: "SERVICE_KEY_INVALID" },
        403,
      );
    }
    return next();
  }

  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return next();

  const token = c.req.header("x-turnstile-token");
  let valid = false;
  if (token) {
    try {
      const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: clientIp(c),
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        const result = (await response.json()) as { success?: boolean };
        valid = result.success === true;
      }
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    return c.json(
      {
        error: "No se pudo verificar que no eres un robot. Intenta de nuevo.",
        code: "CAPTCHA_FAILED",
      },
      403,
    );
  }
  return next();
}
