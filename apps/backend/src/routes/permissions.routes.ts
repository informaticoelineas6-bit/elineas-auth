import { requireAdmin } from "@backend/middleware/admin.ts";
import { requireIdentity } from "@backend/middleware/identity.ts";
import { requireSession } from "@backend/middleware/session.ts";
import {
  MyPermissionSchema,
  PermissionSchema,
} from "@backend/openapi/business.schemas.ts";
import {
  bearerAuthSecurity,
  forbiddenResponse,
  unauthorizedResponse,
} from "@backend/openapi/schemas.ts";
import {
  listMyPermissions,
  listPermissions,
} from "@backend/services/permission.service.ts";
import type { AppEnv } from "@backend/types/hono-env.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const meRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "listMyPermissions",
  tags: ["Permissions"],
  summary:
    "Listar los permisos efectivos del usuario autenticado en el sistema auth",
  description:
    "Si el usuario tiene el rol admin, devuelve el catálogo completo (comodín). " +
    "Es lo que el panel usa para decidir qué secciones mostrar/ocultar.",
  security: bearerAuthSecurity,
  // Acepta sesión O JWT propio del IS, igual que GET /api/user-roles/me: es
  // información sobre uno mismo, de riesgo bajo, y los backends consumidores
  // también pueden necesitarla.
  middleware: [requireIdentity] as const,
  responses: {
    200: {
      description: "Permisos efectivos del usuario",
      content: {
        "application/json": {
          schema: z.object({ permissions: z.array(MyPermissionSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listPermissions",
  tags: ["Permissions"],
  summary: "Listar el catálogo completo de permisos (resource:action)",
  security: bearerAuthSecurity,
  middleware: [requireSession, requireAdmin] as const,
  responses: {
    200: {
      description: "Catálogo de permisos",
      content: {
        "application/json": {
          schema: z.object({ permissions: z.array(PermissionSchema) }),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

// `/me` es de cualquier usuario autenticado (sus propios permisos); el
// catálogo completo (`/`) sigue siendo solo admin, igual que antes.
const permissionsRoutesBase = new OpenAPIHono<AppEnv>();

export const permissionsRoutes = permissionsRoutesBase
  .openapi(meRoute, async (c) => {
    const permissions = await listMyPermissions(c.get("user").id);
    return c.json({ permissions }, 200);
  })
  .openapi(listRoute, async (c) => {
    const permissions = await listPermissions();
    return c.json({ permissions }, 200);
  });
