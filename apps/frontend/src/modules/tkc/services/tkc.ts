import { unwrap, usersAdminRpc } from "#/modules/common/lib/rpc.ts";
import type { TkcCredentialsInput } from "../shared/types.ts";

// Credenciales del sistema externo TKC de un usuario. Las tres llamadas exigen
// rol admin en el IS.
//
// Ninguna devuelve la contraseña: el IS solo la entrega en el login de su
// propio dueño. El panel, por tanto, nunca puede mostrarla — solo decir qué
// usuario de TKC hay enlazado y permitir reemplazarlo.

export async function getUserTkc(userId: string) {
	const { tkc } = await unwrap(
		usersAdminRpc[":id"].tkc.$get({ param: { id: userId } }),
	);
	return tkc;
}

export async function setUserTkc(userId: string, input: TkcCredentialsInput) {
	const { tkc } = await unwrap(
		usersAdminRpc[":id"].tkc.$put({ param: { id: userId }, json: input }),
	);
	return tkc;
}

export function removeUserTkc(userId: string) {
	return unwrap(usersAdminRpc[":id"].tkc.$delete({ param: { id: userId } }));
}
