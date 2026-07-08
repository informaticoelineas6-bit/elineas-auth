import { z } from "@hono/zod-openapi";

export const UserSchema = z
  .object({
    id: z.string().openapi({ example: "usr_9f8a2b" }),
    name: z.string().openapi({ example: "Ada Lovelace" }),
    email: z.email().openapi({ example: "ada@mercadoelineas.com" }),
    emailVerified: z.boolean(),
    image: z.string().nullable().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    role: z.string().nullable().optional(),
    banned: z.boolean().nullable().optional(),
    banReason: z.string().nullable().optional(),
    banExpires: z.date().nullable().optional(),
  })
  .openapi("User");

export const SessionSchema = z
  .object({
    id: z.string(),
    token: z.string(),
    userId: z.string(),
    expiresAt: z.date(),
    createdAt: z.date(),
    updatedAt: z.date(),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    impersonatedBy: z.string().nullable().optional(),
    activeOrganizationId: z.string().nullable().optional(),
  })
  .openapi("Session");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "No autorizado" }),
    code: z.string().optional().openapi({ example: "UNAUTHORIZED" }),
  })
  .openapi("ErrorResponse");

export const StatusResponseSchema = z
  .object({ status: z.boolean() })
  .openapi("StatusResponse");

export const SuccessResponseSchema = z
  .object({ success: z.boolean() })
  .openapi("SuccessResponse");

export const TokenResponseSchema = z
  .object({ token: z.string().nullable() })
  .openapi("TokenResponse");

export const AuthResultSchema = z
  .object({ user: UserSchema, token: z.string().nullable() })
  .openapi("AuthResult");

export const JwkSchema = z
  .object({
    kid: z.string().optional(),
    kty: z.string().optional(),
    alg: z.string().optional(),
    use: z.string().nullable().optional(),
    n: z.string().nullable().optional(),
    e: z.string().nullable().optional(),
    crv: z.string().nullable().optional(),
    x: z.string().nullable().optional(),
    y: z.string().nullable().optional(),
  })
  .passthrough()
  .openapi("Jwk");

export const JwksResponseSchema = z
  .object({ keys: z.array(JwkSchema) })
  .openapi("JwksResponse");

export const bearerAuthSecurity = [{ bearerAuth: [] }];

export const unauthorizedResponse = {
  description: "No hay una sesión válida",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

export const badRequestResponse = {
  description: "Solicitud inválida",
  content: { "application/json": { schema: ErrorResponseSchema } },
};
