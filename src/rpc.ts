// Entry público del contrato RPC del paquete `@elineas/api` (ver campo
// "exports" en package.json: `@elineas/api/rpc`).
//
// Expone ÚNICAMENTE el tipo del grafo de rutas, no código ejecutable, para que
// los consumidores (el cliente RPC, el frontend admin) obtengan type safety
// extremo a extremo sin arrastrar el runtime del servidor (BD, Redis, auth).
export type { AppType } from "./app";
