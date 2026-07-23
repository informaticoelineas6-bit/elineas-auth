import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import { env } from "@/config/env";
import type { AppEnv } from "@/types/hono-env";

// Verificador del JWT que emite este propio IS (plugin `jwt()` de better-auth).
// Se valida LOCALMENTE contra el JWKS que este mismo servidor publica:
// createRemoteJWKSet cachea las claves públicas y solo las refresca ante un
// `kid` desconocido (rotación), así que en régimen normal no hay una llamada de
// red por request. Es exactamente el patrón que usan los backends consumidores
// (ver README §5.1), aplicado aquí a los tokens que el propio IS firma.
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", env.BETTER_AUTH_URL));

type SessionUser = AppEnv["Variables"]["user"];

/**
 * Autenticación para endpoints pensados también para **backends consumidores**
 * (hoy solo `GET /api/user-roles/me`): acepta una sesión normal —cookie o token
 * de sesión opaco como `Bearer`, resuelta por better-auth— **o** un JWT firmado
 * por este IS.
 *
 * Motivo del fallback: un backend que verifica el JWT contra el JWKS de forma
 * stateless (el flujo recomendado en el README §5.1/§7) reenvía ESE MISMO JWT
 * para resolver roles. Pero `auth.api.getSession` solo entiende el token de
 * sesión opaco, no el JWT del plugin `jwt()`; sin este fallback, `/me` respondía
 * 401 a esos backends y la resolución de roles cross-sistema era imposible.
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
      const { payload } = await jwtVerify(header.slice(7), jwks, {
        issuer: env.BETTER_AUTH_URL,
      });
      if (payload.sub) {
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
