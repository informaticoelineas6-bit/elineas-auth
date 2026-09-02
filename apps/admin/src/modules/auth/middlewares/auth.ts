import { createMiddleware } from "@tanstack/react-start";
import { getAuthSession } from "#/modules/auth/lib/session.ts";

// Adjunta la sesión (o null) al contexto de la server fn. No rechaza nada por
// sí solo: úsalo cuando la ruta/acción deba comportarse distinto si hay o no
// usuario, pero pueda ejecutarse igualmente sin uno.
export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const session = await getAuthSession();
		return next({ context: { session } });
	},
);

// Igual que authMiddleware pero además exige sesión: úsalo en server fns que
// solo tiene sentido llamar ya autenticado (el equivalente a requireSession
// en la API). Las rutas de página deben proteger la navegación aparte con
// `beforeLoad` (ver routes/_authed.tsx); esto solo protege la propia acción.
export const requireAuthMiddleware = createMiddleware({ type: "function" })
	.middleware([authMiddleware])
	.server(async ({ next, context }) => {
		if (!context.session) throw new Error("No autenticado");
		return next({ context: { session: context.session } });
	});
