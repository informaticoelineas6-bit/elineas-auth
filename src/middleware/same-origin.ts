import type { Context, Next } from "hono";
import { env } from "@/config/env";

// Protección CSRF ligera para rutas que cambian estado SIN cuerpo JSON (p. ej.
// sign-out): en esos casos no hay preflight CORS que las cubra, así que un
// formulario cross-site podría dispararlas con las cookies de sesión de la
// víctima.
//
// La comprobación es "bloquea solo lo demostrablemente cross-site":
//   - Si el navegador envía `Sec-Fetch-Site: cross-site` → se rechaza.
//   - Si hay cabecera `Origin`, debe estar en la lista permitida (CORS).
// Las peticiones servidor-a-servidor (sin Origin ni Sec-Fetch-Site) se
// permiten: no son un vector CSRF porque no llevan cookies del navegador.
export async function requireSameOrigin(c: Context, next: Next) {
  const fetchSite = c.req.header("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return c.json({ error: "Origen no permitido", code: "CSRF_BLOCKED" }, 403);
  }

  const origin = c.req.header("origin");
  if (origin && !env.ALLOWED_ORIGINS.includes(origin)) {
    return c.json({ error: "Origen no permitido", code: "CSRF_BLOCKED" }, 403);
  }

  await next();
}
