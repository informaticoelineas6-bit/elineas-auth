import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import type { AppEnv } from "@/types/hono-env";
import {
  ChangeEmailBodySchema,
  ChangeEmailResponseSchema,
  ChangePasswordBodySchema,
  ChangePasswordResponseSchema,
  StatusResponseSchema,
  UpdateUserBodySchema,
  UserSchema,
  badRequestResponse,
  bearerAuthSecurity,
  unauthorizedResponse,
} from "@/openapi/schemas";
import {
  changeEmailFn,
  changePasswordFn,
  getMeFn,
  updateMeFn,
} from "@/services/user.service";

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "getMe",
  tags: ["Users"],
  summary: "Obtener el perfil del usuario autenticado",
  security: bearerAuthSecurity,
  responses: {
    200: {
      description: "Perfil del usuario",
      content: {
        "application/json": { schema: z.object({ user: UserSchema }) },
      },
    },
    401: unauthorizedResponse,
  },
});

const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
  operationId: "updateMe",
  tags: ["Users"],
  summary: "Actualizar el perfil del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: { content: { "application/json": { schema: UpdateUserBodySchema } } },
  },
  responses: {
    200: {
      description: "Perfil actualizado",
      content: { "application/json": { schema: StatusResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

const changePasswordRoute = createRoute({
  method: "post",
  path: "/me/change-password",
  operationId: "changePassword",
  tags: ["Users"],
  summary: "Cambiar la contraseña del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: {
      content: { "application/json": { schema: ChangePasswordBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Contraseña actualizada",
      content: { "application/json": { schema: ChangePasswordResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

const changeEmailRoute = createRoute({
  method: "post",
  path: "/me/change-email",
  operationId: "changeEmail",
  tags: ["Users"],
  summary: "Cambiar el email del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: {
      content: { "application/json": { schema: ChangeEmailBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Solicitud de cambio de email procesada",
      content: { "application/json": { schema: ChangeEmailResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

// El middleware se registra como sentencia sobre la instancia base (no dentro
// de la cadena): OpenAPIHono.use() devuelve un `Hono` base sin `.openapi`, así
// que encadenarlo cortaría la inferencia de tipos del RPC. Registrado antes de
// las rutas, el orden de ejecución en runtime es el mismo (middleware primero).
const usersRoutesBase = new OpenAPIHono<AppEnv>();
usersRoutesBase.use("*", requireSession);

export const usersRoutes = usersRoutesBase
  .openapi(getMeRoute, getMeFn)
  .openapi(updateMeRoute, updateMeFn)
  .openapi(changePasswordRoute, changePasswordFn)
  .openapi(changeEmailRoute, changeEmailFn);

// El auto-borrado de cuenta está deshabilitado (ver lib/auth.ts). La baja de un
// usuario la realiza un admin sobre el recurso correspondiente, no el propio
// usuario, por lo que no se expone un endpoint DELETE /me.
