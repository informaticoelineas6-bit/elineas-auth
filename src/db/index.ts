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
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  // Espera máxima por una conexión libre del pool. Acotado a 5s (antes 10s):
  // si el pool está agotado, la petición falla rápido y de forma visible en
  // lugar de encolar clientes durante 10s (efecto convoy que amplifica el
  // atasco). Con los timeouts de query de abajo el pool no debería agotarse.
  connectionTimeoutMillis: 5_000,
  // El servidor mata cualquier query que supere este tiempo. Sin esto, una
  // query bloqueada por un lock o un plan lento retiene su conexión de forma
  // indefinida; 20 de esas agotan el pool y TODA la API deja de responder.
  statement_timeout: 10_000,
  // Tope del lado cliente: deja de esperar la respuesta aunque el servidor no
  // haya matado la query (p. ej. conexión colgada a nivel de red).
  query_timeout: 12_000,
  // Una transacción que queda abierta e inactiva (BEGIN sin COMMIT por un fallo
  // a mitad) retiene locks y su conexión; el servidor la aborta pasado esto.
  idle_in_transaction_session_timeout: 15_000,
});

// Handler de errores de conexiones IDLE del pool. Es imprescindible: cuando una
// conexión inactiva se cae (reinicio de Postgres, corte de red, failover), `pg`
// emite un evento `error` en el pool. Sin este listener, Node lo trata como una
// excepción no capturada y TUMBA todo el proceso —no solo la petición afectada—.
// Con él, la conexión rota se descarta y el pool crea una nueva de forma
// transparente en la siguiente petición.
pool.on("error", (error) => {
  console.error(
    "Error en una conexión idle del pool de Postgres:",
    error instanceof Error ? error.message : error,
  );
});

export const db = drizzle({ client: pool, relations });
