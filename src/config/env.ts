// src/config/env.ts
import { config } from "dotenv";

const environment = process.env.APP_ENV ?? "local";
// override: false → las variables ya presentes en el entorno real
// (Docker Compose, shell, CI) tienen prioridad sobre el archivo .env.
// Es imprescindible en Docker: compose inyecta DATABASE_URL apuntando al
// servicio `postgres`, y no debe ser sobrescrita por el `localhost` de
// .env.local (que solo es válido desde el host).
config({ path: `.env.${environment}`, quiet: true, override: false });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en el entorno "${environment}"`);
  return value;
}

export const env = {
  APP_ENV: environment,
  DATABASE_URL: required("DATABASE_URL"),
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
  ALLOWED_ORIGIN: required("ALLOWED_ORIGIN"),
  // Slug del sistema que representa a este propio identity server. Un usuario
  // es "admin" si tiene el rol `admin` dentro de este sistema. El primer admin
  // se siembra manualmente en BD (bootstrap).
  ADMIN_SYSTEM_SLUG: process.env.ADMIN_SYSTEM_SLUG ?? "auth",
  ADMIN_ROLE_NAME: process.env.ADMIN_ROLE_NAME ?? "admin",
};