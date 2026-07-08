// src/config/env.ts
import { config } from "dotenv";

const environment = process.env.APP_ENV ?? "local";
config({ path: `.env.${environment}` });

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
};