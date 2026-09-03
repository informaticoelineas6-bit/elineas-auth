import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { env } from "@backend/config/env.ts";
import { relations } from "@backend/db/relations.ts";

// Un único driver de Postgres (el cliente NATIVO de Bun, `Bun.SQL`) para todos
// los entornos —local, staging y producción—, de modo que el comportamiento sea
// idéntico en todas partes. Producción usa su propio contenedor de Postgres (ver
// docker-compose.prod.yml), no un Postgres serverless externo.
//
// Sustituye al paquete `pg`: Bun trae el protocolo de Postgres integrado, así
// que no hace falta ninguna dependencia externa (ni `pg` ni sus ~11 transitivas
// pg-pool/pg-protocol/pg-types/postgres-*).

// --- Timeouts de SERVIDOR ---
//
// OJO: `Bun.SQL` NO acepta `statement_timeout` ni
// `idle_in_transaction_session_timeout` como opciones del constructor, e IGNORA
// EN SILENCIO cualquier opción que no reconozca (no lanza). Pasárselas como con
// `pg` compilaría, arrancaría y dejaría los dos timeouts en 0 sin un solo aviso.
//
// La vía que sí funciona es el parámetro `options` de libpq en la URL, que
// Postgres aplica como `-c clave=valor` al arrancar cada sesión. Se inyecta aquí
// en vez de pedirlo en DATABASE_URL para que la política viva junto a este
// comentario y no haya que replicarla en los .env de cada entorno.
//
// (`onconnect` NO sirve para esto en Bun 1.4: el callback se ejecuta, pero el
// argumento que recibe no es una función de query, así que no se puede lanzar un
// `SET` desde ahí.)
const SERVER_TIMEOUTS = {
  // El servidor mata cualquier query que supere este tiempo. Sin esto, una query
  // bloqueada por un lock o un plan lento retiene su conexión de forma
  // indefinida; 20 de esas agotan el pool y TODA la API deja de responder.
  statement_timeout: 10_000,
  // Una transacción que queda abierta e inactiva (BEGIN sin COMMIT por un fallo
  // a mitad) retiene locks y su conexión; el servidor la aborta pasado esto.
  idle_in_transaction_session_timeout: 15_000,
};

// Añade los `-c` de arriba al parámetro `options` de la URL, preservando el
// resto de la query string (p. ej. `sslmode`) y cualquier `options` que ya
// viniera informado en DATABASE_URL.
function withServerTimeouts(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const existing = url.searchParams.get("options");
  const flags = Object.entries(SERVER_TIMEOUTS).map(
    ([key, value]) => `-c ${key}=${value}`,
  );
  url.searchParams.set(
    "options",
    [existing, ...flags].filter(Boolean).join(" "),
  );
  return url.toString();
}

// Parámetros del pool explícitos (en vez de los valores por defecto implícitos)
// para que el comportamiento bajo carga sea deliberado: como máximo 20
// conexiones, con timeouts acotados para no acumular conexiones colgadas ni
// esperar indefinidamente a que haya una libre.
//
// OJO: a diferencia de `pg`, los timeouts de `Bun.SQL` van en SEGUNDOS, no en
// milisegundos.
// Se pone a true justo antes del cierre deliberado del pool (closeDatabase),
// para distinguir en `onclose` un apagado ordenado de una caída real.
let closing = false;

export const sqlClient = new SQL({
  url: withServerTimeouts(env.DATABASE_URL),
  max: 20,
  idleTimeout: 30,
  // Espera máxima por una conexión libre del pool. Acotado a 5s: si el pool está
  // agotado, la petición falla rápido y de forma visible en lugar de encolar
  // clientes durante más tiempo (efecto convoy que amplifica el atasco). Con el
  // statement_timeout de arriba el pool no debería agotarse.
  connectionTimeout: 5,
  // Handler de cierre de conexiones del pool. Cuando una conexión se cae
  // (reinicio de Postgres, corte de red, failover), aquí solo se registra: el
  // pool descarta la conexión rota y crea una nueva de forma transparente en la
  // siguiente petición. Es el equivalente al `pool.on("error")` que `pg` exigía
  // para que un fallo de conexión idle no tumbara el proceso entero.
  //
  // OJO: a diferencia de aquel `pool.on("error")` —que solo se emitía ante un
  // fallo real—, el `onclose` de Bun se invoca en TODOS los cierres, incluidos
  // los esperados: los 20 de `end()` en el apagado ordenado y los de expiración
  // por `idleTimeout`. Loguearlos todos llenaría el log de ruido en cada
  // despliegue, así que solo se registra lo inesperado.
  onclose: (error) => {
    if (closing) return;
    const message = error instanceof Error ? error.message : String(error);
    if (/idle timeout/i.test(message)) return;
    console.error("Conexión del pool de Postgres cerrada:", message);
  },
});

// Cierra el pool en el apagado ordenado (ver src/index.ts). Silencia antes el
// `onclose` de arriba: los 20 cierres que provoca `end()` son esperados, no un
// incidente que merezca 20 líneas de error en cada `docker stop`.
export async function closeDatabase(): Promise<void> {
  closing = true;
  await sqlClient.end();
}

// NOTA: `pg` tenía además un `query_timeout` de 12s (tope de CLIENTE, por si el
// socket queda colgado a nivel de red sin que el servidor llegue a matar la
// query). `Bun.SQL` no expone equivalente; la defensa que queda es el
// statement_timeout del servidor más el timeout global de petición del
// middleware de seguridad (ver middleware/security.ts).

export const db = drizzle({ client: sqlClient, relations });
