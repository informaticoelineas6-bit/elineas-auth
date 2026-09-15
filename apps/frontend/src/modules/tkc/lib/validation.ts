import { tkcPassword, tkcUsername } from "@elineas/auth-contracts";
import { z } from "zod";

// Reglas de las credenciales del sistema externo TKC. Las primitivas vienen de
// `@elineas/auth-contracts`, igual que el resto: son las MISMAS que aplica el
// IS, así que el panel no puede volverse más estricto (bloqueando credenciales
// válidas en TKC) ni más laxo (dejando que el 400 lo dé el servidor).
export const tkcCredentialsSchema = z.object({
	username: tkcUsername,
	password: tkcPassword,
});

// Sección de credenciales dentro de un formulario más grande (el alta de
// usuario). Es OPCIONAL en conjunto: con los dos campos vacíos, el alta sigue
// adelante sin credenciales de TKC, que es el caso habitual.
//
// Lo que no se admite es rellenar solo uno. Una contraseña sin usuario no
// identifica ninguna cuenta de TKC y un usuario sin contraseña no sirve para
// autenticar: guardar la mitad crearía un vínculo que nunca funcionaría, y el
// fallo aparecería mucho después, al intentar entrar en TKC.
export const tkcSectionSchema = z
	.object({ username: z.string(), password: z.string() })
	.superRefine((value, ctx) => {
		const username = value.username.trim();
		const hasAny = username.length > 0 || value.password.length > 0;
		if (!hasAny) return;

		const parsedUsername = tkcUsername.safeParse(value.username);
		if (!parsedUsername.success) {
			ctx.addIssue({
				code: "custom",
				path: ["username"],
				message:
					parsedUsername.error.issues[0]?.message ?? "Usuario TKC no válido",
			});
		}
		const parsedPassword = tkcPassword.safeParse(value.password);
		if (!parsedPassword.success) {
			ctx.addIssue({
				code: "custom",
				path: ["password"],
				message:
					parsedPassword.error.issues[0]?.message ??
					"Contraseña de TKC no válida",
			});
		}
	});

/**
 * Valores de la sección → cuerpo del IS. Devuelve `undefined` cuando no se
 * rellenó nada, que es lo que el servidor espera para "sin credenciales" (el
 * campo `tkc` es opcional; enviar cadenas vacías daría un 400).
 */
export function toTkcPayload(value: {
	username: string;
	password: string;
}): { username: string; password: string } | undefined {
	const username = value.username.trim();
	if (!username && !value.password) return undefined;
	return { username, password: value.password };
}
