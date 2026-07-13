import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config/env";
import { relations } from "@/db/relations";

// Un único driver de Postgres (TCP estándar, `pg`) para todos los entornos
// —local, staging y producción—, de modo que el comportamiento sea idéntico en
// todas partes. Producción usa su propio contenedor de Postgres (ver
// docker-compose.prod.yml), no un Postgres serverless externo.
//
// Parámetros del pool explícitos (en vez de los valores por defecto implícitos)
// para que el comportamiento bajo carga sea deliberado: como máximo 20
// conexiones, con timeouts acotados para no acumular conexiones colgadas ni
// esperar indefinidamente a que haya una libre.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle({ client: pool, relations });
