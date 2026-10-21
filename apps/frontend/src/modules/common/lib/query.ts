// staleTime para "catálogos": datos que cambian muy poco (roles, sistemas) y
// que varias vistas piden como fuente para resolver nombres. Con este valor no
// se re-fetchean al re-montar ni al enfocar la ventana durante la sesión de
// trabajo típica; una mutación sobre ellos los invalida igual, así que no
// quedan obsoletos tras un cambio real.
export const CATALOG_STALE_TIME = 5 * 60_000; // 5 min

// Contexto de auth de _authed (sesión + roles + permisos). Se cachea en Query
// para que cambiar de página no repita el round-trip al IS en cada navegación.
export const AUTHED_CONTEXT_KEY = ["auth", "context"] as const;
export const AUTHED_CONTEXT_STALE_TIME = 60_000; // 1 min

// Los loaders solo "calientan" la caché: la página ya lee con useQuery. Si el
// loader devuelve la promesa, el router espera al fetch antes de cambiar de
// página y el clic parece no hacer nada. En cliente se lanza sin esperar (la
// página pinta al instante con su estado de carga); en servidor (SSR) sí se
// espera para que los datos viajen en el HTML inicial.
export function deferOnClient<T>(promise: Promise<T>): Promise<T> | undefined {
	if (typeof window === "undefined") return promise;
	promise.catch(() => {});
	return undefined;
}
