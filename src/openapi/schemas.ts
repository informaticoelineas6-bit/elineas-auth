import { z } from "@hono/zod-openapi";
import { SystemSchema } from "@/openapi/business.schemas";

export const SignUpBodySchema = z
  .object({
    name: z.string().openapi({ example: "Ada Lovelace" }),
    email: z.email().openapi({ example: "ada@mercadoelineas.com" }),
    password: z.string().min(1).openapi({ example: "super-secreta" }),
    image: z.string().optional(),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
    // Opcional en el registro: si se indica, enlaza la sesión al sistema.
    systemSlug: z.string().optional().openapi({ example: "pos" }),
  })
  .openapi("SignUpBody");

export const SignInBodySchema = z
  .object({
    email: z.string().openapi({ example: "ada@mercadoelineas.com" }),
    password: z.string().openapi({ example: "super-secreta" }),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
    // Obligatorio: cada login pertenece a un sistema concreto.
    systemSlug: z.string().openapi({ example: "pos" }),
  })
  .openapi("SignInBody");

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
  .object({
    user: UserSchema,
    token: z.string().nullable(),
    system: SystemSchema.nullable().optional(),
  })
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
  .loose()
  .openapi("Jwk");

export const JwksResponseSchema = z
  .object({ keys: z.array(JwkSchema) })
  .openapi("JwksResponse");

export const UpdateUserBodySchema = z
  .object({
    name: z.string().optional(),
    image: z.string().optional(),
  })
  .openapi("UpdateUserBody");

export const ChangePasswordBodySchema = z
  .object({
    newPassword: z.string().openapi({ example: "nueva-super-secreta" }),
    currentPassword: z.string().openapi({ example: "super-secreta" }),
    revokeOtherSessions: z.boolean().optional(),
  })
  .openapi("ChangePasswordBody");

export const ChangePasswordResponseSchema = z
  .object({
    token: z.string().nullable().optional(),
    user: UserSchema,
  })
  .openapi("ChangePasswordResponse");

export const ChangeEmailBodySchema = z
  .object({
    newEmail: z.email().openapi({ example: "nueva@mercadoelineas.com" }),
    callbackURL: z.string().optional(),
  })
  .openapi("ChangeEmailBody");

export const ChangeEmailResponseSchema = z
  .object({
    user: UserSchema.optional(),
    status: z.boolean(),
  })
  .openapi("ChangeEmailResponse");

export const DeleteUserBodySchema = z
  .object({
    callbackURL: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
  })
  .openapi("DeleteUserBody");

export const DeleteUserResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi("DeleteUserResponse");

export const bearerAuthSecurity = [{ bearerAuth: [] }];

export const unauthorizedResponse = {
  description: "No hay una sesión válida",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

export const badRequestResponse = {
  description: "Solicitud inválida",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

export const forbiddenResponse = {
  description: "Requiere privilegios de administrador",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

export const notFoundResponse = {
  description: "Recurso no encontrado",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

export const conflictResponse = {
  description: "Conflicto de unicidad",
  content: { "application/json": { schema: ErrorResponseSchema } },
};
