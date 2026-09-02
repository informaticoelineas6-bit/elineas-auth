// Genera el fichero OpenAPI estático que consume Postman/Insomnia a partir del
// mismo grafo de rutas que sirve la API en vivo. Ejecutar tras cambiar rutas o
// esquemas para mantener sincronizada la documentación:
//
//   bun run openapi:generate
//
// Reutiliza createApp() (src/app.ts), por lo que necesita las mismas variables
// de entorno que el resto de scripts (DATABASE_URL, BETTER_AUTH_*, ...). No abre
// ningún puerto ni conecta a la BD: solo serializa el registro de OpenAPI.
import { createApp, openApiInfo } from "@/app";

const OUTPUT = "postman/elineas-auth.openapi.json";

const app = createApp();

const doc = app.getOpenAPIDocument({
  openapi: "3.0.0",
  info: openApiInfo,
  servers: [{ url: "http://localhost:8080", description: "Servidor local" }],
});

await Bun.write(OUTPUT, `${JSON.stringify(doc, null, 2)}\n`);

console.log(`OpenAPI escrito en ${OUTPUT}`);
