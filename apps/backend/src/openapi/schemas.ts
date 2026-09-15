import {
  companyEmail as CompanyEmail,
  currentPassword as CurrentPassword,
  displayName as DisplayName,
  imageUrl as ImageUrl,
  loginEmail as LoginEmail,
  password as Password,
  signInPassword as SignInPassword,
  tkcPassword as TkcPassword,
  tkcUsername as TkcUsername,
} from "@elineas/auth-contracts";
import { z } from "@hono/zod-openapi";
import {
  CreateEmployeeBodySchema,
  EmployeeSchema,
  SystemSchema,
} from "@backend/openapi/business.schemas.ts";

// Las reglas de validación de estos campos NO viven aquí: son el contrato que
// comparten el servidor y sus consumidores, así que están en
// `@elineas/auth-contracts` (packages/auth-contracts). Antes estaban escritas
// dos veces —aquí y en el panel— y habían divergido de verdad: el panel exigía
// mayúscula, minúscula y carácter especial en la contraseña y el servidor no,
// de modo que una llamada directa a la API podía fijar una contraseña débil.
//
// Aquí solo se les añade la metadata de OpenAPI (`.openapi({ example })`), que
// es documentación y no validación.

// ---------------------------------------------------------------------------
// Credenciales del sistema externo TKC
// ---------------------------------------------------------------------------
// El IS no autentica contra TKC: custodia las credenciales de cada persona y se
// las entrega a SU cliente al iniciar sesión, para que pueda autenticarse allí
// sin volver a pedírselas.
export const TkcCredentialsBodySchema = z
  .object({
    username: TkcUsername.openapi({ example: "ada.lovelace" }),
    password: TkcPassword.openapi({ example: "la-contraseña-de-tkc" }),
  })
  .openapi("TkcCredentialsBody");

// Vista administrativa: SIN la contraseña. Un admin necesita saber qué usuario
// de TKC tiene asignado cada persona y poder reemplazarlo, pero no leerlo en
// claro. Así la contraseña sale del servidor por un único camino —el login de
// su propio dueño— y no queda al alcance de cualquier sesión de admin.
export const TkcKeySummarySchema = z
  .object({
    id: z.uuid(),
    username: z.string().openapi({ example: "ada.lovelace" }),
    linkedAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("TkcKeySummary");

export const TkcKeySummaryResponseSchema = z
  .object({ tkc: TkcKeySummarySchema.nullable() })
  .openapi("TkcKeySummaryResponse");

export const SignUpBodySchema = z
  .object({
    name: DisplayName.openapi({ example: "Ada Lovelace" }),
    email: CompanyEmail.openapi({ example: "ada@mercadoelineas.com" }),
    // Se valida aquí también para dar un error claro antes de llegar a la capa
    // de auth (better-auth aplica la misma política).
    password: Password.openapi({ example: "tu-contraseña-segura" }),
    image: ImageUrl.optional(),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
    // Opcional en el registro: si se indica, enlaza la sesión al sistema.
    systemSlug: z.string().optional().openapi({ example: "pos" }),
    // Credenciales del sistema externo TKC, opcionales: si se indican, se
    // enlazan al usuario recién creado.
    tkc: TkcCredentialsBodySchema.optional(),
  })
  .openapi("SignUpBody");

export const SignInBodySchema = z
  .object({
    email: LoginEmail.openapi({ example: "ada@example.com" }),
    password: SignInPassword.openapi({ example: "tu-contraseña-segura" }),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
    // Obligatorio: cada login pertenece a un sistema concreto.
    systemSlug: z.string().openapi({ example: "pos" }),
  })
  .openapi("SignInBody");

export const UserSchema = z
  .object({
    id: z.uuid().openapi({ example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
    name: z.string().openapi({ example: "Ada Lovelace" }),
    email: z.email().openapi({ example: "ada@example.com" }),
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
    id: z.uuid(),
    token: z.string(),
    userId: z.uuid(),
    expiresAt: z.date(),
    createdAt: z.date(),
    updatedAt: z.date(),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    impersonatedBy: z.string().nullable().optional(),
    activeOrganizationId: z.string().nullable().optional(),
  })
  .openapi("Session");

// Sesión SIN el token, para exponerla a los clientes. El token es un secreto de
// portador (quien lo tiene, es la sesión): devolverlo en un listado convierte
// cualquier XSS en el cliente en el secuestro de TODAS las sesiones del usuario.
// La revocación de una sesión concreta se hace por `id` (ver /sessions/revoke).
export const SafeSessionSchema = SessionSchema.omit({ token: true }).openapi(
  "SafeSession",
);

// Sesión + datos mínimos del usuario dueño, para el listado administrativo
// (un admin ve sesiones de todos los usuarios y necesita saber de quién es
// cada una). Igual que en `Employee.user`, solo id/name/email.
// `system` es a qué sistema pertenece la sesión (ver `sessionSystem`):
// `null` si la sesión no llegó a enlazarse (p. ej. sesiones previas a esta
// función).
export const AdminSafeSessionSchema = SafeSessionSchema.extend({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
  system: z
    .object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
}).openapi("AdminSafeSession");

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
    // Credenciales de TKC del usuario que acaba de entrar, en claro y solo
    // aquí. `null` si no tiene ninguna enlazada (el caso habitual): el campo
    // está siempre presente para que el cliente no tenga que distinguir entre
    // "sin credenciales" y "campo ausente".
    tkc: TkcCredentialsBodySchema.nullable(),
  })
  .openapi("AuthResult");

// Alta combinada usuario + empleado (POST /api/employees/with-user). Se anida
// para evitar la colisión de `name` (nombre visible del usuario vs. nombre de
// pila del empleado) y para dejar claro qué campos pertenecen a cada recurso.
// El `userId` del empleado NO se acepta aquí: lo fija el servidor con el id del
// usuario recién creado, que es justo el vínculo que este endpoint garantiza.
export const CreateEmployeeWithUserBodySchema = z
  .object({
    user: SignUpBodySchema.pick({
      name: true,
      email: true,
      password: true,
      image: true,
    }),
    employee: CreateEmployeeBodySchema.omit({ userId: true }),
    // Opcional: la mayoría de las altas no tiene credenciales de TKC. Si se
    // indican, se enlazan al usuario recién creado en la misma operación.
    tkc: TkcCredentialsBodySchema.optional(),
  })
  .openapi("CreateEmployeeWithUserBody");

export const EmployeeWithUserResultSchema = z
  .object({
    user: UserSchema,
    employee: EmployeeSchema,
    // Sin la contraseña, igual que el resto de respuestas administrativas:
    // confirma qué usuario de TKC quedó enlazado. `null` si no se enviaron.
    tkc: TkcKeySummarySchema.nullable(),
  })
  .openapi("EmployeeWithUserResult");

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
    name: DisplayName.optional(),
    image: ImageUrl.optional(),
  })
  .openapi("UpdateUserBody");

export const ChangePasswordBodySchema = z
  .object({
    // La nueva contraseña debe cumplir la misma política que el alta (12-128);
    // sin esta validación se aceptaba cualquier cadena y la política mínima la
    // ponía better-auth (más laxa), permitiendo bajar a una contraseña débil.
    newPassword: Password.openapi({ example: "tu-nueva-contraseña" }),
    currentPassword: CurrentPassword.openapi({ example: "tu-contraseña-actual" }),
    revokeOtherSessions: z.boolean().optional(),
  })
  .openapi("ChangePasswordBody");

// Cambio de contraseña de OTRO usuario, ejecutado por un admin. Es una acción
// distinta del cambio propio (ChangePasswordBodySchema), no una variante: el
// admin no conoce la contraseña actual del usuario, así que no se puede pedir.
export const AdminChangePasswordBodySchema = z
  .object({
    newPassword: Password.openapi({ example: "la-nueva-contraseña" }),
    // La contraseña del ADMIN que ejecuta la acción, NO la del usuario objetivo.
    // Re-autenticación ante una acción sensible: con solo el rol admin, una
    // sesión robada bastaría para apropiarse de cualquier cuenta del IS.
    currentPassword: CurrentPassword.openapi({
      example: "tu-contraseña-de-admin",
    }),
    // Cerrar las sesiones abiertas del usuario. Por defecto sí: un reseteo
    // suele responder a una contraseña comprometida, y sin revocar, quien ya
    // estuviera dentro seguiría dentro pese al cambio.
    revokeSessions: z.boolean().optional().default(true),
  })
  .openapi("AdminChangePasswordBody");

export const AdminChangePasswordResponseSchema = z
  .object({
    status: z.boolean(),
    // Cuántas sesiones se cerraron (0 si no se pidió revocar o no había ninguna).
    revokedSessions: z.number().int().openapi({ example: 2 }),
  })
  .openapi("AdminChangePasswordResponse");

export const ChangePasswordResponseSchema = z
  .object({
    token: z.string().nullable().optional(),
    user: UserSchema,
  })
  .openapi("ChangePasswordResponse");

export const ChangeEmailBodySchema = z
  .object({
    newEmail: CompanyEmail.openapi({ example: "nueva@mercadoelineas.com" }),
    // Re-autenticación: el cambio de email se aplica sin verificación por correo
    // (updateEmailWithoutVerification), así que una sesión robada podría
    // consumar el robo de la cuenta. Exigir la contraseña actual lo evita sin
    // depender de envío de correos.
    currentPassword: CurrentPassword.openapi({ example: "tu-contraseña-segura" }),
    callbackURL: z.string().optional(),
  })
  .openapi("ChangeEmailBody");

export const ChangeEmailResponseSchema = z
  .object({
    status: z.boolean(),
    // Con verificación por correo activada, el cambio NUNCA es inmediato: queda
    // pendiente hasta que el usuario confirma el enlace enviado al nuevo correo.
    // Es siempre true (se expone explícitamente para que el frontend no tenga
    // que inferirlo del cuerpo, que solo trae `status`).
    pendingVerification: z.boolean(),
  })
  .openapi("ChangeEmailResponse");

export const VerifyEmailBodySchema = z
  .object({
    token: z.string().openapi({ example: "eyJhbGciOi..." }),
  })
  .openapi("VerifyEmailBody");

export const VerifyEmailResponseSchema = z
  .object({
    status: z.boolean(),
  })
  .openapi("VerifyEmailResponse");

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

export const serviceUnavailableResponse = {
  description:
    "Función no disponible por configuración del servidor (p. ej. falta " +
    "TKC_SECRET_KEY para operar con credenciales de TKC)",
  content: { "application/json": { schema: ErrorResponseSchema } },
};
