import { env } from "@backend/config/env.ts";
import { authDb } from "@backend/db/auth-relational-shim.ts";
import * as schema from "@backend/db/auth-schema.ts";
import { sendChangeEmailVerification } from "@backend/lib/mail.ts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, jwt } from "better-auth/plugins";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // `authDb` (no `db` a secas): mismo cliente/relaciones, pero con `db.query`
  // parcheado para el adaptador de drizzle de better-auth. Ver
  // db/auth-relational-shim.ts para el porqué — resumen: sin el parche,
  // iniciar sesión falla siempre con "User not found" (independiente de la
  // contraseña) por un bug conocido de better-auth con Relations v2 de
  // drizzle-orm.
  database: drizzleAdapter(authDb, {
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
  // Los ids de las tablas de better-auth son uuid v4, no el string aleatorio de
  // 32 caracteres que genera por defecto. Con `generateId: "uuid"` y el adaptador
  // de drizzle sobre `pg` (que declara supportsUUIDs), better-auth NO añade `id`
  // al INSERT: lo delega al DEFAULT gen_random_uuid() de la columna. Es decir,
  // esta opción y el `uuid(...).defaultRandom()` de auth-schema.ts van juntos;
  // cambiar una sin la otra rompe el alta de usuarios/sesiones.
  advanced: {
    // `joins: true` es lo que hace que el login (findUserByEmail con
    // includeAccounts) una user+account en una sola consulta en vez de
    // devolver el usuario sin su cuenta de credenciales. Va junto con el
    // parche de db/auth-relational-shim.ts: sin `joins:true` el login falla
    // (sin cuenta que verificar); con `joins:true` pero sin el parche,
    // revienta por un bug de better-auth con Relations v2 de drizzle-orm. Ver
    // el comentario largo en auth-relational-shim.ts.
    database: { generateId: "uuid", joins: true },
  },
  plugins: [jwt(), bearer()],
});
