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
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  // Auto-borrado de cuenta deshabilitado: la baja de un usuario la gestiona un
  // admin (no el propio usuario). Ver DELETE en los flujos administrativos.
  user: { deleteUser: { enabled: false } },
  plugins: [jwt(), bearer()],
});
