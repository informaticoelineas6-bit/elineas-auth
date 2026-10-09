import { auth } from "@backend/lib/auth.ts";
import { forwardAuthHeaders, handleError, HttpError, issueJwt } from "@backend/lib/http.ts";
import { generateInitialPassword, sendAccountInvite } from "@backend/lib/invite.ts";
import {
  bindSessionToSystem,
  resolveActiveSystem,
} from "@backend/services/session-system.service.ts";
import { userHasRoleInAnySystem, userHasRoleInSystem } from "@backend/services/user-role.service.ts";
import {
  assertTkcCredentialsUsable,
  getUserTkcCredentials,
  setUserTkcCredentials,
} from "@backend/services/tkc-key.service.ts";
import type { z } from "@hono/zod-openapi";
import type {
  SignInBodySchema,
  SetPasswordBodySchema,
  SignUpBodySchema,
  VerifyEmailBodySchema,
} from "@backend/openapi/schemas.ts";
import { Context } from "hono";

type SignUpInput = { out: { json: z.infer<typeof SignUpBodySchema> } };
type SignInInput = { out: { json: z.infer<typeof SignInBodySchema> } };
type SetPasswordInput = { out: { json: z.infer<typeof SetPasswordBodySchema> } };
type VerifyEmailInput = { out: { json: z.infer<typeof VerifyEmailBodySchema> } };

export const signUpFn = async (c: Context<any, string, SignUpInput>) => {
  try {
    // Este endpoint lo invoca un admin para crear la cuenta de OTRO usuario
    // (ver middleware requireAdmin en la ruta). Por eso NO se reenvían las
    // cabeceras de sesión de la respuesta: harían que el navegador del admin
    // adoptara la sesión/cookies del usuario recién creado. Se devuelve el
    // usuario, su token y el sistema en el cuerpo, sin tocar la sesión del admin.
    // Se usa el body ya validado por Zod (valid("json")), que descarta campos
    // desconocidos y evita reenviar propiedades no previstas a better-auth.
    const { systemSlug, tkc, ...credentials } = c.req.valid("json");
    const sys = systemSlug ? await resolveActiveSystem(systemSlug) : null;
    // Si el alta trae credenciales de TKC, se comprueba ANTES de crear nada que
    // el servidor puede cifrarlas. Sin esto, un servidor sin TKC_SECRET_KEY
    // crearía el usuario y fallaría después, dejando una cuenta a medio
    // configurar que el llamante cree que no existe.
    if (tkc) assertTkcCredentialsUsable();
    const { response } = await auth.api.signUpEmail({
      // Sin contraseña en la petición: aleatoria e inservible, el dueño fija la
      // suya con el enlace de invitación. Si el llamador envía una, se respeta
      // (compatibilidad) pero tampoco se manda por correo.
      body: { ...credentials, password: credentials.password ?? generateInitialPassword() },
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
    if (tkc) await setUserTkcCredentials(response.user.id, tkc);
    const token = await issueJwt(response.token);
    // Invitación sin await: un fallo del correo no debe hacer fallar un alta
    // que ya se completó (sendAccountInvite captura y loguea, nunca lanza).
    void sendAccountInvite(credentials.email);
    // `tkc: null` a propósito, aunque el alta las haya guardado: esta respuesta
    // va al ADMIN que crea la cuenta, no a su dueño. Devolvérselas solo le
    // repetiría lo que acaba de enviar, a cambio de que el secreto viaje una
    // vez más y quede en una respuesta que no lo necesita. Las credenciales se
    // entregan en el login de su dueño (ver signInFn).
    return c.json({ user: response.user, token, system: sys, tkc: null }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

// La autenticación es correcta, pero el acceso exige tener al menos un rol en el
// sistema indicado (o en alguno, si no se indicó). Si no lo tiene, se revoca la
// sesión recién creada y se lanza 403. Lo comparten el login con contraseña y el
// de Google, para que ambos apliquen exactamente la misma regla.
export async function assertAccessOrRevoke(params: {
  userId: string;
  sessionToken: string;
  sys: { id: string; slug: string } | null;
}) {
  const { userId, sessionToken, sys } = params;
  const allowed = sys
    ? await userHasRoleInSystem(userId, sys.id)
    : await userHasRoleInAnySystem(userId);
  if (allowed) return;
  await auth.api.revokeSession({
    body: { token: sessionToken },
    headers: new Headers({ authorization: `Bearer ${sessionToken}` }),
  });
  throw new HttpError(
    403,
    sys
      ? `El usuario no tiene ningún rol en el sistema "${sys.slug}"`
      : "El usuario no tiene roles en ningún sistema",
    "NO_ROLES_IN_SYSTEM",
  );
}

export const signInFn = async (c: Context<any, string, SignInInput>) => {
  try {
    // systemSlug es opcional. Con slug, la sesión queda ligada a ese sistema
    // (una sola sesión por usuario y sistema). Sin slug, el token es
    // multi-sistema: la sesión no se liga a ninguno y sirve en todos aquellos
    // donde el usuario tenga roles (cada sistema los consulta con
    // /api/user-roles/me?systemSlug=...).
    // Body ya validado por Zod: descarta campos desconocidos.
    const { systemSlug, ...credentials } = c.req.valid("json");
    const sys = systemSlug ? await resolveActiveSystem(systemSlug) : null;
    const { headers, response } = await auth.api.signInEmail({
      body: credentials,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });

    // La autenticación es correcta, pero el acceso exige tener al menos un rol
    // en el sistema indicado (o en alguno, si no se indicó). Si no lo tiene, se
    // revoca la sesión recién creada y NO se reenvían las cabeceras de sesión
    // (el navegador no llega a quedar logueado), devolviendo 403.
    await assertAccessOrRevoke({
      userId: response.user.id,
      sessionToken: response.token,
      sys,
    });

    forwardAuthHeaders(c, headers);
    if (sys) {
      await bindSessionToSystem({
        sessionToken: response.token,
        userId: response.user.id,
        systemId: sys.id,
      });
    }
    const token = await issueJwt(response.token);

    // Credenciales del sistema externo TKC, en claro y SOLO aquí: este es el
    // único punto de la API que las devuelve, y se las lleva su propio dueño
    // recién autenticado, no un tercero (las rutas de administración exponen el
    // usuario de TKC pero nunca su contraseña).
    //
    // `getUserTkcCredentials` no lanza nunca: si faltara la clave de cifrado o
    // una fila estuviera alterada, devuelve null y el login sigue funcionando.
    // TKC es una comodidad, no un requisito para entrar al IS.
    const tkc = await getUserTkcCredentials(response.user.id);

    // La respuesta lleva un secreto reutilizable, así que no debe quedarse en
    // ninguna caché intermedia ni en el historial del navegador. `no-store` es
    // el único valor que lo impide en todas ellas (`no-cache` permite
    // almacenar y revalidar, que aquí no basta).
    c.header("Cache-Control", "no-store");

    return c.json({ user: response.user, token, system: sys, tkc }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};

// Confirma el token de verificación de cambio de correo. better-auth define
// verify-email como GET con el token en query y, si se le pasa callbackURL,
// responde con un redirect. Aquí se expone como POST (el token viaja en el
// cuerpo desde la página del frontend) y SIN callbackURL, de modo que
// better-auth devuelve JSON `{ status, user }` en vez de redirigir, encajando
// con el resto de la API. Es un endpoint público: quien confirma puede no tener
// sesión (abre el enlace desde su correo), y el token firmado es la credencial.
export const verifyEmailFn = async (
  c: Context<any, string, VerifyEmailInput>,
) => {
  try {
    const { token } = c.req.valid("json");
    const { headers, response } = await auth.api.verifyEmail({
      query: { token },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json({ status: response?.status ?? true }, 200);
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
// Se cachea la PROMESA (no el valor resuelto): cuando el caché expira bajo
// tráfico concurrente, solo la primera petición dispara getJwks y las demás
// esperan esa misma promesa (single-flight), en vez de lanzar N llamadas
// simultáneas a better-auth durante el hueco entre expiración y resolución.
let jwksCache: { value: ReturnType<typeof auth.api.getJwks>; expiresAt: number } | null =
  null;

export const getJwksFn = async (c: Context) => {
  const now = Date.now();
  let entry = jwksCache;
  if (!entry || entry.expiresAt <= now) {
    const value = auth.api.getJwks();
    entry = { value, expiresAt: now + JWKS_CACHE_TTL_MS };
    jwksCache = entry;
    // Si la llamada falla, se invalida la entrada para que la siguiente petición
    // reintente, en lugar de servir el error cacheado durante todo el TTL. (El
    // error de ESTA petición sigue propagándose a handleError vía el await.)
    value.catch(() => {
      if (jwksCache === entry) jwksCache = null;
    });
  }
  return c.json(await entry.value, 200);
};

// Público: el dueño de una cuenta invitada fija su contraseña con el token de un
// solo uso del correo. better-auth lo consume y cierra las sesiones previas.
export const setPasswordFn = async (
  c: Context<any, string, SetPasswordInput>,
) => {
  try {
    const { token, newPassword } = c.req.valid("json");
    await auth.api.resetPassword({ body: { token, newPassword } });
    return c.json({ status: true }, 200);
  } catch (error) {
    return handleError(error, c);
  }
};
