import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, like, lt } from "drizzle-orm";
import { deleteCookie } from "hono/cookie";
import { decodeJwt } from "jose";
import type { Context } from "hono";
import type { z } from "@hono/zod-openapi";
import { env } from "@backend/config/env.ts";
import { db } from "@backend/db/index.ts";
import { account, user, verification } from "@backend/db/auth-schema.ts";
import { auth } from "@backend/lib/auth.ts";
import { forwardAuthHeaders, handleError, HttpError, issueJwt } from "@backend/lib/http.ts";
import type {
  GoogleExchangeBodySchema,
  GoogleStartQuerySchema,
} from "@backend/openapi/schemas.ts";
import { assertAccessOrRevoke } from "@backend/services/auth.service.ts";
import {
  bindSessionToSystem,
  resolveActiveSystem,
} from "@backend/services/session-system.service.ts";
import { getUserTkcCredentials } from "@backend/services/tkc-key.service.ts";

// Login con Google por REDIRECT, pensado para que lo use cualquier app (incluido
// el propio frontend del IS). Flujo:
//
//   1. La app manda al navegador a GET /api/auth/google/start con `redirect_to`
//      (a dónde volver), `code_challenge` (PKCE S256) y, opcional, `state` y
//      `systemSlug`.
//   2. start valida todo y redirige a Google (better-auth guarda el state OAuth).
//   3. Google vuelve a /api/auth/callback/google (lo atiende better-auth): enlaza
//      con el usuario que ya existe por email (NO crea cuentas) y abre sesión.
//   4. better-auth redirige a GET /api/auth/google/finish, que aplica las mismas
//      reglas que el login con contraseña (roles, sistema), cambia la sesión por
//      un código de un solo uso de 60 s y devuelve el navegador a `redirect_to`
//      con `?code=...&state=...` (o `?error=CODIGO`).
//   5. El servidor de la app canjea el código en POST /api/auth/google/exchange
//      con el `code_verifier` y recibe lo mismo que /sign-in.
//
// Ningún token de sesión viaja por la URL: solo el código, inútil sin el
// `code_verifier` que nunca salió de la app.

const CODE_TTL_MS = 60_000;
const CODE_PREFIX = "google-login:";

type StartInput = { out: { query: z.infer<typeof GoogleStartQuerySchema> } };
type ExchangeInput = { out: { json: z.infer<typeof GoogleExchangeBodySchema> } };

function assertConfigured() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new HttpError(
      503,
      "El inicio de sesión con Google no está configurado en este servidor",
      "GOOGLE_NOT_CONFIGURED",
    );
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

// `redirect_to` solo puede apuntar a un origen de confianza: sin esto el flujo
// sería un redirect abierto que entrega códigos de login a cualquiera. Se valida
// al empezar Y al terminar (la URL viaja por el navegador entre ambos pasos).
function parseRedirectTo(raw: string | undefined): URL {
  let url: URL;
  try {
    url = new URL(raw ?? "");
  } catch {
    throw new HttpError(400, "redirect_to no es una URL válida", "INVALID_REDIRECT");
  }
  const trusted = new Set(
    [...env.ALLOWED_ORIGINS, ...env.GOOGLE_REDIRECT_ORIGINS].map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return origin;
      }
    }),
  );
  const secure = url.protocol === "https:" || (url.protocol === "http:" && isLoopback(url.hostname));
  if (!secure || url.username || url.password || !trusted.has(url.origin)) {
    throw new HttpError(400, "redirect_to no es un origen permitido", "INVALID_REDIRECT");
  }
  return url;
}

function finishUrl(params: Record<string, string | undefined>) {
  const url = new URL("/api/auth/google/finish", env.BETTER_AUTH_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export const googleStartFn = async (c: Context<any, string, StartInput>) => {
  try {
    assertConfigured();
    const { redirect_to, code_challenge, state, systemSlug } = c.req.valid("query");
    parseRedirectTo(redirect_to);
    // Se valida ya: un slug inválido debe fallar aquí con un JSON claro, no
    // después de que el usuario haya pasado por Google.
    if (systemSlug) await resolveActiveSystem(systemSlug);

    const callback = finishUrl({ redirect_to, code_challenge, state, systemSlug });
    const { headers, response } = await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL: callback,
        // Los errores de Google/enlace también vuelven a finish, que los
        // traduce y devuelve al usuario a la app en vez de dejarlo en una
        // página de error del IS.
        errorCallbackURL: callback,
        disableRedirect: true,
      },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    // La cookie de state OAuth debe llegar al navegador para validar el callback.
    forwardAuthHeaders(c, headers);
    if (!response.url) throw new HttpError(500, "No se pudo iniciar Google", "GOOGLE_START_FAILED");
    c.header("Cache-Control", "no-store");
    return c.redirect(response.url, 302);
  } catch (error) {
    return handleError(error, c);
  }
};

// El callback OAuth lo implementa better-auth; solo se le entrega la petición.
export const googleCallbackFn = (c: Context) => auth.handler(c.req.raw);

// La sesión del navegador sobre el dominio del IS solo existe para este salto:
// las apps usan el token del canje, no la cookie. Se borra siempre para que no
// quede una sesión por cookie viva (y utilizable cross-site) en el IS.
async function clearSessionCookies(c: Context) {
  const { authCookies } = await auth.$context;
  for (const cookie of [
    authCookies.sessionToken,
    authCookies.sessionData,
    authCookies.dontRememberToken,
    authCookies.accountData,
  ]) {
    deleteCookie(c, cookie.name, {
      path: "/",
      secure: cookie.name.startsWith("__Secure-") || cookie.name.startsWith("__Host-"),
    });
  }
}

// Traduce los errores de better-auth/Google a códigos estables para las apps.
function mapOAuthError(error: string): string {
  switch (error) {
    case "signup_disabled":
      return "ACCOUNT_NOT_FOUND";
    case "access_denied":
      return "GOOGLE_ACCESS_DENIED";
    default:
      return "GOOGLE_AUTH_FAILED";
  }
}

async function createLoginCode(value: {
  sessionToken: string;
  systemSlug: string | null;
  challenge: string;
}) {
  const code = randomBytes(32).toString("base64url");
  const now = Date.now();
  // Limpieza oportunista de códigos caducados sin canjear (no hay cron aquí).
  await db
    .delete(verification)
    .where(and(like(verification.identifier, `${CODE_PREFIX}%`), lt(verification.expiresAt, new Date(now))));
  await db.insert(verification).values({
    identifier: CODE_PREFIX + sha256(code).toString("hex"),
    value: JSON.stringify(value),
    expiresAt: new Date(now + CODE_TTL_MS),
  });
  return code;
}

// Avatar de Google -> imagen del usuario. La foto viene en el claim `picture`
// del id_token, que better-auth guarda en la cuenta enlazada en cada login (se
// decodifica sin verificar porque es nuestro propio dato en BD, ya validado al
// recibirlo de Google). Solo se escribe si el usuario no tiene imagen o la que
// tiene ya es de Google (se refresca): una imagen que el propio usuario puso a
// mano no se pisa. Es una comodidad: cualquier fallo se ignora y el login sigue.
async function syncGoogleAvatar(userId: string, currentImage: string | null | undefined) {
  try {
    if (currentImage && !isGoogleImage(currentImage)) return;
    const [row] = await db
      .select({ idToken: account.idToken })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
      .limit(1);
    if (!row?.idToken) return;
    const picture = decodeJwt(row.idToken).picture;
    if (typeof picture !== "string" || picture === currentImage) return;
    // Solo https hacia el CDN de Google: el valor acabará en un <img src>.
    if (!isGoogleImage(picture)) return;
    await db.update(user).set({ image: picture }).where(eq(user.id, userId));
  } catch (error) {
    console.warn("No se pudo sincronizar el avatar de Google:", error);
  }
}

function isGoogleImage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

export const googleFinishFn = async (c: Context) => {
  // Se resuelve primero: sin un redirect_to válido no hay a dónde devolver al
  // usuario, y en ese caso solo cabe responder con el error.
  let target: URL;
  try {
    assertConfigured();
    target = parseRedirectTo(c.req.query("redirect_to"));
  } catch (error) {
    return handleError(error, c);
  }
  const state = c.req.query("state");
  const back = (params: Record<string, string>) => {
    const url = new URL(target);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (state) url.searchParams.set("state", state);
    return c.redirect(url.toString(), 302);
  };

  let sessionToken: string | undefined;
  try {
    c.header("Cache-Control", "no-store");
    const oauthError = c.req.query("error");
    if (oauthError) return back({ error: mapOAuthError(oauthError) });

    const challenge = c.req.query("code_challenge") ?? "";
    const systemSlug = c.req.query("systemSlug") || null;
    const current = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!current) return back({ error: "GOOGLE_AUTH_FAILED" });
    sessionToken = current.session.token;

    const sys = systemSlug ? await resolveActiveSystem(systemSlug) : null;
    await assertAccessOrRevoke({ userId: current.user.id, sessionToken, sys });
    if (sys) {
      await bindSessionToSystem({ sessionToken, userId: current.user.id, systemId: sys.id });
    }
    await syncGoogleAvatar(current.user.id, current.user.image);
    const code = await createLoginCode({ sessionToken, systemSlug, challenge });
    return back({ code });
  } catch (error) {
    // Cualquier fallo tras abrir sesión deja la sesión revocada (la de "sin
    // roles" ya lo está; revocar de nuevo es inocuo).
    if (sessionToken) {
      await auth.api
        .revokeSession({
          body: { token: sessionToken },
          headers: new Headers({ authorization: `Bearer ${sessionToken}` }),
        })
        .catch(() => {});
    }
    if (error instanceof HttpError && error.code) return back({ error: error.code });
    console.error("Error en el cierre del login con Google:", error);
    return back({ error: "GOOGLE_AUTH_FAILED" });
  } finally {
    await clearSessionCookies(c);
  }
};

export const googleExchangeFn = async (c: Context<any, string, ExchangeInput>) => {
  try {
    assertConfigured();
    const { code, code_verifier } = c.req.valid("json");
    // DELETE ... RETURNING: canje atómico y de un solo uso (dos peticiones
    // simultáneas con el mismo código no pueden ganar las dos).
    const [row] = await db
      .delete(verification)
      .where(
        and(
          eq(verification.identifier, CODE_PREFIX + sha256(code).toString("hex")),
          gt(verification.expiresAt, new Date()),
        ),
      )
      .returning({ value: verification.value });
    const invalid = new HttpError(400, "Código inválido o caducado", "INVALID_CODE");
    if (!row) throw invalid;

    const stored = JSON.parse(row.value) as {
      sessionToken: string;
      systemSlug: string | null;
      challenge: string;
    };
    const expected = Buffer.from(stored.challenge);
    const actual = Buffer.from(sha256(code_verifier).toString("base64url"));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      // El código ya está consumido: un intento con verifier erróneo lo quema.
      await auth.api
        .revokeSession({
          body: { token: stored.sessionToken },
          headers: new Headers({ authorization: `Bearer ${stored.sessionToken}` }),
        })
        .catch(() => {});
      throw invalid;
    }

    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${stored.sessionToken}` }),
    });
    if (!session) throw invalid;
    const sys = stored.systemSlug ? await resolveActiveSystem(stored.systemSlug) : null;
    const token = await issueJwt(stored.sessionToken);
    const tkc = await getUserTkcCredentials(session.user.id);

    // Igual que /sign-in: el token de sesión de largo plazo va en la cabecera.
    c.header("set-auth-token", stored.sessionToken);
    c.header("Cache-Control", "no-store");
    return c.json({ user: session.user, token, system: sys, tkc }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};
