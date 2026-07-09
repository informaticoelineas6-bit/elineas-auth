import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { env } from "@/config/env";
import { relations } from "@/db/relations";

// Neon requiere su driver serverless (WebSocket/HTTP); cualquier otro Postgres
// (p. ej. el contenedor local de docker-compose) usa el driver TCP estándar.
const isNeon = env.DATABASE_URL.includes("neon.tech");

export const db = isNeon
  ? drizzleNeon({ client: new NeonPool({ connectionString: env.DATABASE_URL }), relations })
  : drizzlePg({ client: new PgPool({ connectionString: env.DATABASE_URL }), relations });
