import { hc } from "hono/client";
import type { AppType } from "@elineas/backend/rpc";

// Opciones aceptadas por hc (headers, fetch personalizado, etc.). Se extrae del
// propio tipo de hc para no desincronizarse si la firma cambia entre versiones.
export type ClientOptions = NonNullable<Parameters<typeof hc>[1]>;

// Cliente RPC tipado contra el grafo de rutas de la API (`AppType`). Todas las
// llamadas (`client.api.users.me.$get()`, etc.) quedan tipadas de extremo a
// extremo: método, path, body y respuesta se validan en tiempo de compilación
// a partir del mismo servidor, sin duplicar contratos ni generar código.
//
// `baseUrl` es la raíz de la API (p. ej. "http://localhost:8080"). Las rutas ya
// incluyen el prefijo "/api" según están montadas en el servidor.
export function createApiClient(baseUrl: string, options?: ClientOptions) {
  return hc<AppType>(baseUrl, options);
}

export type ApiClient = ReturnType<typeof createApiClient>;

// Reexporta el tipo del contrato por si el consumidor quiere tiparse contra él
// directamente (p. ej. para envolver el cliente en hooks de datos).
export type { AppType };
