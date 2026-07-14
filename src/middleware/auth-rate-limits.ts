import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { rateLimit } from "@/middleware/rate-limit";
import { requireSameOrigin } from "@/middleware/same-origin";
import type { AppEnv } from "@/types/hono-env";

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
  // Login: dos límites complementarios. Uno por IP (frena a un atacante desde
  // una misma máquina) y otro por CUENTA (frena la fuerza bruta distribuida
  // contra un único usuario desde muchas IPs).
  app.use(
    "/api/auth/sign-in",
    rateLimit({ name: "sign-in", windowMs: 60_000, max: 10 }),
  );
  app.use(
    "/api/auth/sign-in",
    rateLimit({
      name: "sign-in-account",
      windowMs: 15 * 60_000,
      max: 10,
      key: signInAccountKey,
    }),
  );
  app.use(
    "/api/auth/sign-up",
    rateLimit({ name: "sign-up", windowMs: 60_000, max: 5 }),
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
}
