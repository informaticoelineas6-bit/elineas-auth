import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt, bearer } from "better-auth/plugins";
import { db } from "@/db/index";
import * as schema from "@/db/auth-schema";
import { env } from "@/config/env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 24,
  },
  // Caché de sesión en cookie firmada: evita una consulta a BD en CADA petición
  // autenticada (requireSession). La cookie va firmada con BETTER_AUTH_SECRET, así
  // que no es falsificable; su vida corta (5 min) acota cuánto puede tardar en
  // reflejarse una revocación de sesión en las rutas que solo leen la sesión.
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    // Auto-borrado de cuenta deshabilitado: la baja de un usuario la gestiona un
    // admin (no el propio usuario). Ver DELETE en los flujos administrativos.
    deleteUser: { enabled: false },
    // Cambio de email habilitado. Como este IS no verifica emails
    // (emailVerified arranca en false y no hay envío de correos configurado),
    // el cambio se aplica directamente para cuentas no verificadas. Si en el
    // futuro se añade verificación por correo, endurecer este flujo.
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
  },
  plugins: [jwt(), bearer()],
});
