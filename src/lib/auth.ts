import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt, bearer } from "better-auth/plugins";
import { db } from "@/db/index";
import * as schema from "@/db/auth-schema";
import { env } from "@/config/env";
import { sendChangeEmailVerification } from "@/lib/mail";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // La política de contraseñas debe coincidir con la validación Zod de las rutas
  // (SignUpBodySchema / ChangePasswordBodySchema: min 12, max 128). Si no
  // coinciden, una contraseña válida para Zod pero fuera del rango de better-auth
  // se aceptaría en la validación y luego fallaría aquí con un error confuso.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  // Caché de sesión en cookie firmada: evita una consulta a BD en CADA petición
  // autenticada (requireSession). La cookie va firmada con BETTER_AUTH_SECRET, así
  // que no es falsificable; su vida corta (5 min) acota cuánto puede tardar en
  // reflejarse una revocación de sesión en las rutas que solo leen la sesión.
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Verificación por correo. Solo interviene en el flujo de CAMBIO de email: no
  // hay verificación en el alta (sendOnSignUp no está activo) ni se exige en el
  // login (emailAndPassword.requireEmailVerification no está activo), así que
  // esto no afecta a los usuarios existentes ni bloquea el acceso.
  //
  // El enlace que better-auth genera por defecto apunta a este backend
  // (`${baseURL}/verify-email`), un endpoint que este IS NO expone como handler
  // catch-all (solo envuelve auth.api.* en rutas propias). Por eso se
  // reescribe el enlace para que apunte al FRONTEND: la página /verify-email
  // extrae el token y lo confirma vía POST /api/auth/verify-email (que sí
  // exponemos, ver auth.routes.ts). Se usa el primer origen permitido como base
  // del frontend (en esta app hay un único frontend).
  emailVerification: {
    expiresIn: 60 * 60, // 1 h de validez del enlace
    sendVerificationEmail: async ({ user, token }) => {
      const frontendBase = env.ALLOWED_ORIGINS[0];
      const url = `${frontendBase}/verify-email?token=${encodeURIComponent(token)}`;
      // `user.email` aquí es el NUEVO correo (better-auth lo sustituye antes de
      // llamar a este callback en el flujo de cambio), así que el enlace llega
      // a la dirección que se quiere verificar.
      await sendChangeEmailVerification({ to: user.email, url });
    },
  },
  user: {
    // Auto-borrado de cuenta deshabilitado: la baja de un usuario la gestiona un
    // admin (no el propio usuario). Ver DELETE en los flujos administrativos.
    deleteUser: { enabled: false },
    // Cambio de email con verificación por correo: al solicitar el cambio, el
    // nuevo correo NO se aplica hasta que el usuario confirma el enlace enviado
    // a esa dirección (updateEmailWithoutVerification: false). La ruta también
    // exige la contraseña actual (ver user.service.ts) como barrera adicional
    // frente a una sesión robada.
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
    },
  },
  plugins: [jwt(), bearer()],
});
