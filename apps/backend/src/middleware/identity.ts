import { auth } from "@backend/lib/auth.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import type { Context, Next } from "hono";

// Verificador del JWT que emite este propio IS (plugin `jwt()` de better-auth).
//
// OJO: NO se verifica contra `createRemoteJWKSet(new URL("/api/auth/jwks",
// env.BETTER_AUTH_URL))`. `BETTER_AUTH_URL` es el dominio PÚBLICO
// (https://auth.mercadoelineas.com) y su Caddy externo proxea ese host
// completo al FRONTEND (SPA), no a este backend — solo `/api/*` en ese
// dominio llega aquí, y ni siquiera eso es seguro asumir desde dentro del
// propio proceso. Si este backend intentara resolver SU PROPIO JWKS por esa
// URL pública, la petición saldría por la red, volvería a entrar por
// Cloudflare/Caddy y en el mejor de los casos daría una vuelta absurda; en el
// peor (como pasó en producción) cae en el catch-all del frontend, que
// devuelve un 404 en HTML que `jwtVerify` no puede parsear como JWKS — y todo
// consumidor autenticado con JWT (en vez de cookie/sesión) recibía 401 pase
// lo que pase con el token.
//
// En vez de eso, `auth.api.verifyJWT` (endpoint `serverOnly` del plugin
// `jwt()`) se llama IN-PROCESO: no hace ningún fetch HTTP, resuelve las
// claves públicas directo desde el mismo adapter/BD que usó `jwt()` para
// FIRMAR el token. Es más simple, más rápido y no depende de que la URL
// pública resuelva de vuelta a este backend (ni de Caddy, ni de red).
type SessionUser = AppEnv["Variables"]["user"];

/**
 * Autenticación para endpoints pensados también para **backends consumidores**
 * (hoy solo `GET /api/user-roles/me`): acepta una sesión normal —cookie o token
 * de sesión opaco como `Bearer`, resuelta por better-auth— **o** un JWT firmado
 * por este IS.
 *
 * Motivo del fallback: un backend que verifica el JWT contra el JWKS de forma
 * stateless (el flujo recomendado en el README §5.1/§7, usando el JWKS
 * PÚBLICO en `/api/auth/jwks`) reenvía ESE MISMO JWT para resolver roles. Pero
 * `auth.api.getSession` solo entiende el token de sesión opaco, no el JWT del
 * plugin `jwt()`; sin este fallback, `/me` respondía 401 a esos backends y la
 * resolución de roles cross-sistema era imposible.
 *
 * Las rutas de administración siguen usando `requireSession` (solo sesión), sin
 * aceptar JWTs, para no ampliar su superficie a tokens stateless de vida corta.
 */
export async function requireIdentity(c: Context<AppEnv>, next: Next) {
  // 1) Sesión: cookie o `Bearer <token de sesión opaco>` (plugin bearer()).
  let result: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    result = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch {
    result = null;
  }
  if (result) {
    c.set("user", result.user);
    c.set("session", result.session);
    return next();
  }

  // 2) Fallback: `Bearer <JWT firmado por este IS>`. No hay `session` asociada
  //    (el JWT es stateless); los consumidores de `session` ya lo tratan como
  //    opcional (ver request-log.ts), y `/me` solo necesita `user.id`.
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      const { payload } = await auth.api.verifyJWT({
        body: { token: header.slice(7) },
      });
      if (payload?.sub) {
        c.set("user", {
          id: payload.sub,
          email: (payload.email as string | undefined) ?? "",
          name: (payload.name as string | undefined) ?? "",
          emailVerified: Boolean(payload.emailVerified),
          image: (payload.image as string | null | undefined) ?? null,
          createdAt: new Date((payload.createdAt as string | undefined) ?? 0),
          updatedAt: new Date((payload.updatedAt as string | undefined) ?? 0),
        } as SessionUser);
        return next();
      }
    } catch {
      // Firma/issuer/exp inválidos: cae al 401 de abajo.
    }
  }

  return c.json({ error: "No autorizado" }, 401);
}
