import {
	unwrap,
	usersAdminRpc,
	usersRpc,
} from "#/modules/common/lib/rpc.ts";
import type {
	AdminChangePasswordInput,
	ChangeEmailInput,
	ChangePasswordInput,
	UpdateProfileInput,
} from "../shared/types.ts";

// Módulo de referencia de la migración al RPC tipado: la ruta, el método, el
// cuerpo y la respuesta los deriva TypeScript del grafo de rutas del servidor,
// así que ya no hay tipos de respuesta escritos a mano ni rutas como string.
// Ver `#/modules/common/lib/rpc.ts` y el README del monorepo.
//
// Los tipos de ENTRADA siguen viniendo de los esquemas zod del panel (que a su
// vez usan `@elineas/auth-contracts`): son los que validan el formulario antes
// de enviarlo, y coinciden con lo que el servidor espera porque ambos aplican
// las mismas primitivas.

export async function getMe() {
	// `{ param: {} }` no es decorativo: @hono/zod-openapi incluye siempre `param`
	// en el tipo de entrada de la ruta, incluso cuando el path no lleva ninguno
	// (`/me`), y Hono lo marca como obligatorio. En runtime no añade nada.
	const { user } = await unwrap(usersRpc.me.$get({ param: {} }));
	return user;
}

export function updateMe(input: UpdateProfileInput) {
	return unwrap(usersRpc.me.$patch({ json: input }));
}

export function changePassword(input: ChangePasswordInput) {
	return unwrap(usersRpc.me["change-password"].$post({ json: input }));
}

export function changeEmail(input: ChangeEmailInput) {
	return unwrap(usersRpc.me["change-email"].$post({ json: input }));
}

// Cambia la contraseña de OTRO usuario. Requiere rol admin en el IS; el
// `currentPassword` del input es el del ADMIN, no el del usuario objetivo.
export function adminChangeUserPassword(
	userId: string,
	input: AdminChangePasswordInput,
) {
	return unwrap(
		usersAdminRpc[":id"]["change-password"].$post({
			param: { id: userId },
			json: input,
		}),
	);
}
