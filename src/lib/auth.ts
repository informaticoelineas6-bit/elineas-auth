import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt, } from "better-auth/plugins";
import { db } from "../db/index";
import { env } from "../config/env.js";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  experimental: { joins: true },
  emailAndPassword: { enabled: true },
  plugins: [
    jwt(),     
  ],
});