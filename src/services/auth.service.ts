import { auth } from "@/lib/auth";
import { forwardAuthHeaders, handleError, HttpError, issueJwt } from "@/lib/http";
import {
  bindSessionToSystem,
  resolveActiveSystem,
} from "@/services/session-system.service";
import { userHasRoleInSystem } from "@/services/user-role.service";
import type { z } from "@hono/zod-openapi";
import type { SignInBodySchema, SignUpBodySchema } from "@/openapi/schemas";
import { Context } from "hono";

type SignUpInput = { out: { json: z.infer<typeof SignUpBodySchema> } };
type SignInInput = { out: { json: z.infer<typeof SignInBodySchema> } };

export const signUpFn = async (c: Context<any, string, SignUpInput>) => {
  try {
    // Este endpoint lo invoca un admin para crear la cuenta de OTRO usuario
    // (ver middleware requireAdmin en la ruta). Por eso NO se reenvían las
    // cabeceras de sesión de la respuesta: harían que el navegador del admin
    // adoptara la sesión/cookies del usuario recién creado. Se devuelve el
    // usuario, su token y el sistema en el cuerpo, sin tocar la sesión del admin.
    // Se usa el body ya validado por Zod (valid("json")), que descarta campos
    // desconocidos y evita reenviar propiedades no previstas a better-auth.
    const { systemSlug, ...credentials } = c.req.valid("json");
    const sys = systemSlug ? await resolveActiveSystem(systemSlug) : null;
    const { response } = await auth.api.signUpEmail({
      body: credentials,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    if (sys && response.token) {
      await bindSessionToSystem({
        sessionToken: response.token,
        userId: response.user.id,
        systemId: sys.id,
      });
    }
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token, system: sys }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

export const signInFn = async (c: Context<any, string, SignInInput>) => {
  try {
    // systemSlug es obligatorio: cada login pertenece a un sistema concreto.
    // Body ya validado por Zod: descarta campos desconocidos.
    const { systemSlug, ...credentials } = c.req.valid("json");
    const sys = await resolveActiveSystem(systemSlug);
    const { headers, response } = await auth.api.signInEmail({
      body: credentials,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });

    // La autenticación es correcta, pero el acceso a ESTE sistema exige tener al
    // menos un rol en él. Si no lo tiene, se revoca la sesión recién creada y NO
    // se reenvían las cabeceras de sesión (el navegador no llega a quedar
    // logueado), devolviendo 403.
    if (!(await userHasRoleInSystem(response.user.id, sys.id))) {
      await auth.api.revokeSession({
        body: { token: response.token },
        headers: new Headers({ authorization: `Bearer ${response.token}` }),
      });
      throw new HttpError(
        403,
        `El usuario no tiene ningún rol en el sistema "${sys.slug}"`,
        "NO_ROLES_IN_SYSTEM",
      );
    }

    forwardAuthHeaders(c, headers);
    await bindSessionToSystem({
      sessionToken: response.token,
      userId: response.user.id,
      systemId: sys.id,
    });
    const token = await issueJwt(response.token);
    return c.json({ user: response.user, token, system: sys }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

export const signOutFn = async (c: Context) => {
  try {
    const { headers, response } = await auth.api.signOut({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

export const getTokenFn = async (c: Context) => {
  try {
    const { token } = await auth.api.getToken({ headers: c.req.raw.headers });
    return c.json({ token }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

// El JWKS es público y sin autenticación: sin caché, cada verificador que lo
// consulte dispara una operación en better-auth (y potencialmente en BD), un
// vector barato de agotamiento de recursos. Las claves casi nunca rotan, así que
// se cachea en memoria unos minutos. El coste es que una clave recién rotada
// tarda como mucho este TTL en publicarse; los verificadores ya cachean el JWKS
// por su cuenta, de modo que este margen es aceptable.
const JWKS_CACHE_TTL_MS = 5 * 60_000;
let jwksCache: { value: Awaited<ReturnType<typeof auth.api.getJwks>>; expiresAt: number } | null =
  null;

export const getJwksFn = async (c: Context) => {
  const now = Date.now();
  if (!jwksCache || jwksCache.expiresAt <= now) {
    jwksCache = { value: await auth.api.getJwks(), expiresAt: now + JWKS_CACHE_TTL_MS };
  }
  return c.json(jwksCache.value, 200);
};
