import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "../lib/auth.js";
import { requireSession } from "../middleware/session.js";
import { forwardAuthHeaders, handleAuthError } from "../lib/http.js";
import type { AppEnv } from "../types/hono-env.js";
import {
  StatusResponseSchema,
  UserSchema,
  badRequestResponse,
  bearerAuthSecurity,
  unauthorizedResponse,
} from "../openapi/schemas.js";

export const usersRoutes = new OpenAPIHono<AppEnv>();

usersRoutes.use("*", requireSession);

const UpdateUserBodySchema = z
  .object({
    name: z.string().optional(),
    image: z.string().optional(),
  })
  .openapi("UpdateUserBody");

const ChangePasswordBodySchema = z
  .object({
    newPassword: z.string().openapi({ example: "nueva-super-secreta" }),
    currentPassword: z.string().openapi({ example: "super-secreta" }),
    revokeOtherSessions: z.boolean().optional(),
  })
  .openapi("ChangePasswordBody");

const ChangePasswordResponseSchema = z
  .object({
    token: z.string().nullable().optional(),
    user: UserSchema,
  })
  .openapi("ChangePasswordResponse");

const ChangeEmailBodySchema = z
  .object({
    newEmail: z.email().openapi({ example: "nueva@mercadoelineas.com" }),
    callbackURL: z.string().optional(),
  })
  .openapi("ChangeEmailBody");

const ChangeEmailResponseSchema = z
  .object({
    user: UserSchema.optional(),
    status: z.boolean(),
  })
  .openapi("ChangeEmailResponse");

const DeleteUserBodySchema = z
  .object({
    callbackURL: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
  })
  .openapi("DeleteUserBody");

const DeleteUserResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi("DeleteUserResponse");

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Users"],
  summary: "Obtener el perfil del usuario autenticado",
  security: bearerAuthSecurity,
  responses: {
    200: {
      description: "Perfil del usuario",
      content: { "application/json": { schema: z.object({ user: UserSchema }) } },
    },
    401: unauthorizedResponse,
  },
});

usersRoutes.openapi(getMeRoute, (c) => {
  return c.json({ user: c.get("user") }, 200);
});

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

usersRoutes.openapi(updateMeRoute, async (c) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.updateUser({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const changePasswordRoute = createRoute({
  method: "post",
  path: "/me/change-password",
  tags: ["Users"],
  summary: "Cambiar la contraseña del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: { content: { "application/json": { schema: ChangePasswordBodySchema } } },
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

usersRoutes.openapi(changePasswordRoute, async (c) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.changePassword({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

const changeEmailRoute = createRoute({
  method: "post",
  path: "/me/change-email",
  tags: ["Users"],
  summary: "Cambiar el email del usuario autenticado",
  security: bearerAuthSecurity,
  request: {
    body: { content: { "application/json": { schema: ChangeEmailBodySchema } } },
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

usersRoutes.openapi(changeEmailRoute, async (c) => {
  try {
    const body = await c.req.json();
    const { headers, response } = await auth.api.changeEmail({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});

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

usersRoutes.openapi(deleteMeRoute, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { headers, response } = await auth.api.deleteUser({
      body,
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    forwardAuthHeaders(c, headers);
    return c.json(response, 200);
  } catch (error) {
    return handleAuthError(c, error);
  }
});
