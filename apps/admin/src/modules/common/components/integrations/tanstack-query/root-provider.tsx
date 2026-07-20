import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { getErrorStatus } from "@/modules/common/lib/errors.ts";
import { notifySessionExpired } from "@/modules/common/lib/session-expiry.ts";

// Un 401 en cualquier query o mutación significa sesión muerta (isApi autentica
// con el token de sesión, no con el JWT, así que no hay refresh que valga):
// se notifica al router para redirigir al login desde un único sitio.
function handleGlobalError(error: unknown) {
	if (getErrorStatus(error) === 401) notifySessionExpired();
}

export function getContext() {
	const queryClient = new QueryClient({
		queryCache: new QueryCache({ onError: handleGlobalError }),
		mutationCache: new MutationCache({ onError: handleGlobalError }),
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
