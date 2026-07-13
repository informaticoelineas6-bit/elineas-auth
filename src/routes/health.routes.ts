import type { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { db } from "@/db/index";
import type { AppEnv } from "@/types/hono-env";

// Tope del ping de readiness. Corto a propósito: el healthcheck lo ejecuta el
// orquestador cada pocos segundos, así que no debe heredar los timeouts largos
// de query del pool; si la BD no responde ya, queremos marcar "not ready" rápido.
const READINESS_DB_TIMEOUT_MS = 2_000;

async function pingDatabase(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("readiness db ping timeout")),
          READINESS_DB_TIMEOUT_MS,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Endpoints de salud para el orquestador (Docker/K8s). Se registran ANTES que el
// middleware transversal para que no pasen por logger (evita ruido en cada
// sondeo), CORS ni el rate limiting, y para que no dependan de nada externo.
//
// - /health   (liveness): el proceso está vivo y sirve. NO toca la BD, así que
//   un fallo aquí siempre significa "reiníciame".
// - /health/ready (readiness): además comprueba que la BD responde. Un 503 aquí
//   con /health en 200 indica un problema de dependencias, no del proceso.
export function registerHealthChecks(app: OpenAPIHono<AppEnv>) {
  app.get("/health", (c) => c.json({ status: "ok" }, 200));

  app.get("/health/ready", async (c) => {
    const dbOk = await pingDatabase();
    return c.json(
      { status: dbOk ? "ok" : "degraded", db: dbOk },
      dbOk ? 200 : 503,
    );
  });
}
