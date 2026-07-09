import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireSession } from "@/middleware/session";
import type { AppEnv } from "@/types/hono-env";
import {
  ChangeEmailBodySchema,
  ChangeEmailResponseSchema,
  ChangePasswordBodySchema,
  ChangePasswordResponseSchema,
  DeleteUserBodySchema,
  DeleteUserResponseSchema,
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
  deleteMeFn,
  getMeFn,
  updateMeFn,
} from "@/services/user.service";

export const usersRoutes = new OpenAPIHono<AppEnv>();

usersRoutes.use("*", requireSession);

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
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

usersRoutes.openapi(getMeRoute, getMeFn);

const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
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

usersRoutes.openapi(updateMeRoute, updateMeFn);

const changePasswordRoute = createRoute({
  method: "post",
  path: "/me/change-password",
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

usersRoutes.openapi(changePasswordRoute, changePasswordFn);

const changeEmailRoute = createRoute({
  method: "post",
  path: "/me/change-email",
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

usersRoutes.openapi(changeEmailRoute, changeEmailFn);

const deleteMeRoute = createRoute({
  method: "delete",
  path: "/me",
  tags: ["Users"],
  summary: "Eliminar la cuenta del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: {
      required: false,
      content: { "application/json": { schema: DeleteUserBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Cuenta eliminada o solicitud de eliminación enviada",
      content: { "application/json": { schema: DeleteUserResponseSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

usersRoutes.openapi(deleteMeRoute, deleteMeFn);
