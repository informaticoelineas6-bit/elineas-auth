// Contrato de validación compartido del identity server.
//
// Exporta SOLO reglas de validación (zod puro) y helpers sin dependencias de
// runtime, para que lo puedan importar tanto el servidor (Bun) como el panel
// (navegador) sin arrastrar nada de uno al otro. En particular: aquí no entra
// Hono, ni `@hono/zod-openapi`, ni libphonenumber-js.
//
// Los tipos de las RESPUESTAS no se declaran aquí: viajan por el tipo
// `AppType` que expone `@elineas/auth-api/rpc`, derivado de las rutas reales
// del servidor. Ver `apps/admin/src/modules/common/lib/rpc.ts`.

export * from "./dates.ts";
export * from "./pagination.ts";
export * from "./primitives.ts";
