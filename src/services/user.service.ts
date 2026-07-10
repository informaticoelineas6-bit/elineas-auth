import { auth } from "@/lib/auth";
import { forwardAuthHeaders, handleAuthError } from "@/lib/http";
import type { z } from "@hono/zod-openapi";
import type {
  ChangeEmailBodySchema,
  ChangePasswordBodySchema,
  UpdateUserBodySchema,
} from "@/openapi/schemas";
import { Context } from "hono";

type UpdateUserInput = { out: { json: z.infer<typeof UpdateUserBodySchema> } };
type ChangePasswordInput = {
  out: { json: z.infer<typeof ChangePasswordBodySchema> };
};
type ChangeEmailInput = { out: { json: z.infer<typeof ChangeEmailBodySchema> } };

export const getMeFn = async (c: Context) => {
  return c.json({ user: c.get("user") }, 200);
};

export const updateMeFn = async (c: Context<any, string, UpdateUserInput>) => {
  try {
    // Body ya validado por Zod: solo name/image, sin campos desconocidos que
    // pudieran reenviarse a auth.api.updateUser.
    const body = c.req.valid("json");
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
};

export const changePasswordFn = async (
  c: Context<any, string, ChangePasswordInput>,
) => {
  try {
    const body = c.req.valid("json");
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
};

export const changeEmailFn = async (
  c: Context<any, string, ChangeEmailInput>,
) => {
  try {
    const body = c.req.valid("json");
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
};
