import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { env } from "@/config/env";
import { relations } from "@/db/relations";

// Neon requiere su driver serverless (WebSocket/HTTP); cualquier otro Postgres
// (p. ej. el contenedor local de docker-compose) usa el driver TCP estándar.
const isNeon = env.DATABASE_URL.includes("neon.tech");

// Parámetros del pool explícitos (en vez de los valores por defecto implícitos)
// para que el comportamiento bajo carga sea deliberado: como máximo 20
// conexiones, con timeouts acotados para no acumular conexiones colgadas ni
// esperar indefinidamente a que haya una libre.
const poolConfig = {
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
};

export const db = isNeon
  ? drizzleNeon({ client: new NeonPool(poolConfig), relations })
  : drizzlePg({ client: new PgPool(poolConfig), relations });
