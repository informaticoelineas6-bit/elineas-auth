import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { getErrorStatus } from "@/modules/common/lib/errors.ts";
import { AUTHED_CONTEXT_KEY } from "@/modules/common/lib/query.ts";
import { notifySessionExpired } from "@/modules/common/lib/session-expiry.ts";

// Un 401 en cualquier query o mutación significa sesión muerta (isApi autentica
// con el token de sesión, no con el JWT, así que no hay refresh que valga):
// se notifica al router para redirigir al login desde un único sitio.
function handleGlobalError(error: unknown, queryClient?: QueryClient) {
	if (getErrorStatus(error) === 401) {
		queryClient?.removeQueries({ queryKey: AUTHED_CONTEXT_KEY });
		notifySessionExpired();
	}
}

export function getContext() {
	const queryClient: QueryClient = new QueryClient({
		queryCache: new QueryCache({
			onError: (error) => handleGlobalError(error, queryClient),
		}),
		mutationCache: new MutationCache({
			onError: (error) => handleGlobalError(error, queryClient),
			// Cualquier mutación puede alterar roles/permisos/sesión (asignar rol,
			// logout, desactivar usuario...): se marca obsoleto el contexto de auth
			// cacheado para que la siguiente navegación lo resuelva de nuevo.
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: AUTHED_CONTEXT_KEY }),
		}),
		defaultOptions: {
			queries: {
				// staleTime por defecto: sin esto (staleTime 0) toda query se marca
				// stale al instante y re-fetchea en cada montaje y cada foco de
				// ventana. 30s evita ráfagas de refetch al navegar entre secciones
				// sin sacrificar frescura perceptible; los catálogos estables
				// (roles/systems) suben este valor en su queryOptions.
				staleTime: 30_000,
				// Nunca reintentar errores 4xx (401/403/404/409/429): son
				// definitivos y un 429 en bucle empeoraría el rate limit. Los 5xx y
				// los fallos de red sí se reintentan un par de veces.
				retry: (failureCount, error) => {
					const status = getErrorStatus(error);
					if (status && status >= 400 && status < 500) return false;
					return failureCount < 2;
				},
			},
		},
	});

	return {
		queryClient,
	};
}
export default function TanstackQueryProvider() {}
