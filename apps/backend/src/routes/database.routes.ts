import { requireAdmin } from "@backend/middleware/admin.ts";
import { requireSession } from "@backend/middleware/session.ts";
import {
  badRequestResponse,
  bearerAuthSecurity,
  forbiddenResponse,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import { generateDatabaseDump } from "@backend/services/db-export.service.ts";
import { assertCurrentPassword } from "@backend/services/user.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { currentPassword as CurrentPassword } from "@elineas/auth-contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const DatabaseExportBodySchema = z
  .object({
    // La contraseña del ADMIN que exporta: re-autenticación antes de una acción
    // que entrega toda la información de la base de datos.
    currentPassword: CurrentPassword,
  })
  .openapi("DatabaseExportBody");

const DatabaseExportResponseSchema = z
  .object({
    filename: z
      .string()
      .openapi({ example: "elineas-auth-20261012-153000.sql" }),
    generatedAt: z.string(),
    tables: z.number().int(),
    sql: z
      .string()
      .openapi({ description: "Script SQL (esquema + datos, sin secretos)." }),
  })
  .openapi("DatabaseExportResponse");

const exportRoute = createRoute({
  method: "post",
  path: "/export",
  operationId: "exportDatabase",
  tags: ["Database"],
  summary: "Exportar la base de datos como script SQL (requiere rol admin)",
  description:
    "Genera en el momento un script SQL con el esquema y los datos de todas las " +
    "tablas. No incluye secretos: sin filas de session, verification, jwks " +
    "ni request_log, y con los hashes de contraseña y " +
    "tokens OAuth de account a NULL. Exige la contraseña del admin.",
  security: bearerAuthSecurity,
  // Solo admin (no delegable con un permiso): entrega toda la base de datos.
  middleware: [requireSession, requireAdmin] as const,
  request: {
    body: {
      content: { "application/json": { schema: DatabaseExportBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Volcado generado",
      content: { "application/json": { schema: DatabaseExportResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

const databaseRoutesBase = new OpenAPIHono<AppEnv>();

export const databaseRoutes = databaseRoutesBase.openapi(
  exportRoute,
  async (c) => {
    const { currentPassword } = c.req.valid("json");
    await assertCurrentPassword(c.get("user").id, currentPassword);
    const dump = await generateDatabaseDump();
    // El script lleva datos de personas: que no se quede en ninguna caché.
    c.header("Cache-Control", "no-store");
    return c.json(dump, 200);
  },
);
