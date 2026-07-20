import { z } from "@hono/zod-openapi";
import {
  CreateEmployeeBodySchema,
  EmployeeSchema,
  SystemSchema,
} from "@/openapi/business.schemas";

// URL de imagen (avatar): acotada en longitud y restringida a http(s) para
// evitar que se almacene un `javascript:`/`data:` que dispare XSS al renderizar
// <img src=...> en cualquier frontend consumidor.
const ImageUrl = z
  .string()
  .max(2048)
  .regex(/^https?:\/\//i, "Debe ser una URL http(s)");

// Nombre visible de persona: con tope de longitud para no aceptar cadenas
// arbitrariamente grandes que acaben renderizadas sin escapar en un cliente.
const DisplayName = z.string().min(1).max(100);

// Dominio corporativo único admitido para cuentas del IS: el alta de usuarios
// no es autoservicio (la crea un admin), así que restringir el dominio evita
// cuentas con correos ajenos a la empresa. Se aplica al CREAR una cuenta
// (SignUp) o CAMBIAR el correo (ChangeEmail), no al login (SignIn): una
// cuenta ya existente conserva el correo que tenga, aunque fuera de un alta
// anterior a esta regla.
const COMPANY_EMAIL_DOMAIN = "mercadoelineas.com";
const CompanyEmail = z
  .email()
  .refine((email) => email.toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`), {
    message: `El correo debe ser del dominio @${COMPANY_EMAIL_DOMAIN}`,
  });

// Política de contraseña única y compartida por todas las rutas que reciben una
// contraseña NUEVA (alta y cambio). Debe coincidir con la política de
// better-auth (min/maxPasswordLength en lib/auth.ts); tenerla en un único sitio
// evita que se desincronicen. No aplica al login (SignIn), donde solo se
// comprueba contra la contraseña ya almacenada.
const Password = z.string().min(12).max(128);

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
  })
  .openapi("SignUpBody");

export const SignInBodySchema = z
  .object({
    email: z.email().openapi({ example: "ada@example.com" }),
    password: z.string().min(1).max(128).openapi({ example: "tu-contraseña-segura" }),
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
export const AdminSafeSessionSchema = SafeSessionSchema.extend({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
  }),
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
  })
  .openapi("CreateEmployeeWithUserBody");

export const EmployeeWithUserResultSchema = z
  .object({
    user: UserSchema,
    employee: EmployeeSchema,
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
    currentPassword: z.string().openapi({ example: "tu-contraseña-actual" }),
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
    newEmail: CompanyEmail.openapi({ example: "nueva@mercadoelineas.com" }),
    // Re-autenticación: el cambio de email se aplica sin verificación por correo
    // (updateEmailWithoutVerification), así que una sesión robada podría
    // consumar el robo de la cuenta. Exigir la contraseña actual lo evita sin
    // depender de envío de correos.
    currentPassword: z.string().openapi({ example: "tu-contraseña-segura" }),
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
