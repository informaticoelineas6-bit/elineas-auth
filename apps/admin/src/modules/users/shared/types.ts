import type { InferResponseType } from "hono/client";
import type { z } from "zod";
import type { usersRpc } from "#/modules/common/lib/rpc.ts";
import type {
	changeEmailSchema,
	changePasswordFormSchema,
	changePasswordSchema,
	updateProfileSchema,
} from "../lib/validation.ts";

// Los tipos de RESPUESTA se derivan del contrato RPC del servidor, no se
// escriben a mano. Antes este archivo declaraba `User` campo por campo con el
// comentario «esquema `User` de su OpenAPI»: una copia manual que nada obligaba
// a mantener al día. Ahora los deriva TypeScript del grafo de rutas real, así
// que un cambio en el servidor rompe la compilación del panel en vez de
// aparecer en producción.
//
// `import type` sobre `usersRpc`: se importa solo el TIPO del cliente, nunca su
// valor, así que este módulo sigue siendo seguro de importar desde componentes
// de cliente (el cliente RPC lee cookies y es solo-servidor).
//
// Las fechas llegan como string ISO —es lo que sobrevive a JSON— y eso ya viene
// reflejado en el tipo inferido, sin tener que declararlo.

// Usuario del IS. Es el tipo canónico reutilizado por otros módulos (p. ej. el
// alta combinada de empleados).
export type User = InferResponseType<typeof usersRpc.me.$get, 200>["user"];

// El IS emite un JWT nuevo tras cambiar la contraseña (las sesiones se mantienen
// salvo que se pida revocarlas). El token no se persiste en el frontend: la
// server function ya opera con la cookie de sesión.
export type ChangePasswordResult = InferResponseType<
	(typeof usersRpc.me)["change-password"]["$post"],
	200
>;

// El cambio de correo requiere verificación: nunca es inmediato. El IS envía un
// enlace al nuevo correo y responde con `pendingVerification: true`. El correo
// solo se aplica cuando el usuario confirma el enlace (POST /api/auth/verify-email).
export type ChangeEmailResult = InferResponseType<
	(typeof usersRpc.me)["change-email"]["$post"],
	200
>;

export type UpdateProfileResult = InferResponseType<
	typeof usersRpc.me.$patch,
	200
>;

// Los tipos de ENTRADA sí salen de los esquemas zod del panel: son los que
// validan el formulario antes de enviarlo. Sus reglas vienen de
// `@elineas/auth-contracts`, así que coinciden con las del servidor.
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
