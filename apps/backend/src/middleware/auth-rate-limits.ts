import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { failureRateLimit, rateLimit } from "@backend/middleware/rate-limit.ts";
import { clientIp } from "@backend/lib/client-ip.ts";
import { requireSameOrigin } from "@backend/middleware/same-origin.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";

// Extrae el email del cuerpo de una petición de login para poder limitar los
// intentos POR CUENTA (no solo por IP): así una botnet que rota IPs no puede
// hacer fuerza bruta ilimitada contra un único usuario. Hono cachea el cuerpo
// ya parseado, de modo que leerlo aquí no impide que el validador Zod lo lea
// después. Si el cuerpo no es JSON válido o no trae email, se omite el límite
// por cuenta (el límite por IP —registrado aparte— sigue aplicando).
async function signInAccountKey(c: Context): Promise<string | undefined> {
  try {
    const body = (await c.req.json()) as { email?: unknown };
    if (typeof body.email !== "string") return undefined;
    const email = body.email.trim().toLowerCase();
    return email.length > 0 ? email : undefined;
  } catch {
    return undefined;
  }
}

// Protecciones anti-abuso sobre los endpoints sensibles (fuerza bruta /
// credential stuffing). Se registran antes que las rutas para que se ejecuten
// primero.
export function registerAuthRateLimits(app: OpenAPIHono<AppEnv>) {
  // Login: un límite por IP (frena a un atacante desde una misma máquina) y
  // límites por CUENTA solo sobre intentos fallidos (ver más abajo).
  app.use(
    "/api/auth/sign-in",
    rateLimit({ name: "sign-in", windowMs: 60_000, max: 10 }),
  );
  // Por cuenta, contando SOLO los intentos fallidos (401):
  //  · email + IP, umbral bajo: quien falla repetidamente se bloquea a sí mismo;
  //    un atacante no puede dejar fuera al usuario legítimo (otra IP) con unos
  //    pocos intentos.
  //  · solo email, umbral alto: backstop contra fuerza bruta distribuida (botnet
  //    que rota IPs) contra una cuenta concreta.
  app.use(
    "/api/auth/sign-in",
    failureRateLimit({
      name: "sign-in-account-ip",
      windowMs: 15 * 60_000,
      max: 10,
      key: async (c) => {
        const email = await signInAccountKey(c);
        return email === undefined ? undefined : `${email}|${clientIp(c)}`;
      },
    }),
  );
  app.use(
    "/api/auth/sign-in",
    failureRateLimit({
      name: "sign-in-account",
      windowMs: 15 * 60_000,
      max: 100,
      key: signInAccountKey,
    }),
  );
  app.use(
    "/api/auth/sign-up",
    rateLimit({ name: "sign-up", windowMs: 60_000, max: 5 }),
  );
  // Verificación de cambio de correo: público y consume un token firmado. Se
  // limita por IP para que un token no pueda forzarse a base de reintentos.
  app.use(
    "/api/auth/verify-email",
    rateLimit({ name: "verify-email", windowMs: 60_000, max: 10 }),
  );
  // Establecer contraseña con el token del correo: público y consume un token
  // secreto; por IP para que no pueda forzarse a base de reintentos.
  app.use(
    "/api/auth/set-password",
    rateLimit({ name: "set-password", windowMs: 60_000, max: 10 }),
  );
  // Reenvío de invitación: cada hit envía un correo, así que se limita.
  app.use(
    "/api/users/admin/:id/invite",
    rateLimit({ name: "invite", windowMs: 60_000, max: 5 }),
  );
  // JWKS (público) y token (autenticado) sin límite eran un vector barato de
  // agotamiento de recursos: cada hit dispara trabajo en better-auth. El límite
  // por IP es holgado para el uso legítimo (un verificador cachea el JWKS) pero
  // corta el abuso.
  app.use(
    "/api/auth/jwks",
    rateLimit({ name: "jwks", windowMs: 60_000, max: 60 }),
  );
  app.use(
    "/api/auth/token",
    rateLimit({ name: "token", windowMs: 60_000, max: 60 }),
  );
  // Sign-out no lleva cuerpo, así que no hay preflight CORS que lo proteja de
  // un CSRF: se exige mismo origen explícitamente.
  app.use("/api/auth/sign-out", requireSameOrigin);
  // Cambio de contraseña/email: aunque exigen sesión, deben limitarse para que una
  // sesión robada no permita fuerza bruta de la contraseña actual saltándose el
  // límite del login.
  app.use(
    "/api/users/me/change-password",
    rateLimit({ name: "change-password", windowMs: 60_000, max: 5 }),
  );
  app.use(
    "/api/users/me/change-email",
    rateLimit({ name: "change-email", windowMs: 60_000, max: 5 }),
  );
  // Cambio de contraseña de OTRO usuario (admin). Mismo motivo que los dos
  // anteriores y con más razón: verifica la contraseña DEL ADMIN, así que sin
  // límite una sesión de admin robada podría forzarla por fuerza bruta aquí
  // saltándose el límite del login.
  app.use(
    "/api/users/admin/:id/change-password",
    rateLimit({ name: "admin-change-password", windowMs: 60_000, max: 5 }),
  );
}
