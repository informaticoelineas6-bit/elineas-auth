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

// Lee una variable con una lista de valores separados por comas (p. ej. varios
// orígenes CORS). Admite un único valor sin comas por compatibilidad.
function requiredList(name: string): string[] {
  const values = required(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`${name} está vacía en el entorno "${environment}"`);
  }
  return values;
}

export const env = {
  APP_ENV: environment,
  DATABASE_URL: required("DATABASE_URL"),
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
  // Orígenes permitidos por CORS. Varios frontends/APIs consumen este IS, por
  // lo que se admite una lista separada por comas
  // (p. ej. "https://app.midominio.com,https://admin.midominio.com").
  ALLOWED_ORIGINS: requiredList("ALLOWED_ORIGIN"),
  // Slug del sistema que representa a este propio identity server. Un usuario
  // es "admin" si tiene el rol `admin` dentro de este sistema. El primer admin
  // se siembra manualmente en BD (bootstrap).
  ADMIN_SYSTEM_SLUG: process.env.ADMIN_SYSTEM_SLUG ?? "auth",
  ADMIN_ROLE_NAME: process.env.ADMIN_ROLE_NAME ?? "admin",
  // URL de Redis para el rate limiting distribuido (compartido entre réplicas).
  // Opcional: si no se define, el rate limiter degrada a un contador en memoria
  // por instancia (útil en desarrollo local sin Redis).
  REDIS_URL: process.env.REDIS_URL,
  // Días de retención de los logs de peticiones (tabla request_log). El worker
  // de drenado purga a diario las filas más antiguas. 0 = no purgar nunca.
  REQUEST_LOG_RETENTION_DAYS:
    Math.max(0, Number(process.env.REQUEST_LOG_RETENTION_DAYS ?? "90")) || 0,
  // Envío de correos transaccionales. Opcional: si hay RESEND_API_KEY se usa
  // Resend (producción); si no, y hay SMTP_HOST, se usa SMTP (maildev en
  // desarrollo). Sin ninguna de las dos, el mailer queda deshabilitado y solo
  // se avisa por log (mismo patrón de degradación que REDIS_URL).
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Math.max(0, Number(process.env.SMTP_PORT ?? "1025")) || 1025,
  // Remitente de los correos ("Nombre <correo@dominio>"). Con Resend, el
  // dominio del remitente debe estar verificado en su panel.
  EMAIL_FROM:
    process.env.EMAIL_FROM ?? "Mercado Elineas <no-reply@mercadoelineas.com>",
  // Nº de proxies de confianza por delante de la API. Determina cuántos saltos
  // de X-Forwarded-For son fiables al calcular la IP del cliente para el rate
  // limiting. 0 (por defecto) = ignorar XFF y usar solo la IP del socket, que
  // no es falsificable. Ponlo a 1 si hay un reverse proxy propio delante, etc.
  TRUST_PROXY_HOPS:
    Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? "0")) || 0,
};
