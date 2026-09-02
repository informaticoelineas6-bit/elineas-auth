export class AuthApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public code?: string,
		// Segundos hasta poder reintentar (cabecera Retry-After), presente en los
		// 429 del rate limit del IS. Se propaga como propiedad simple, así que
		// sobrevive la serialización del server fn igual que `status`/`code`.
		public retryAfter?: number,
	) {
		super(message);
	}
}

// Se acepta la forma mínima que esta función realmente usa —`ok`, `status`,
// `headers` y `json()`— en vez de `Response` completa: así sirve igual para la
// respuesta de un `fetch` y para el `ClientResponse` del cliente RPC de Hono,
// que es estructuralmente compatible pero no declara todos los miembros de
// `Response` (le falta `textStream`).
type JsonResponse = {
	ok: boolean;
	status: number;
	headers: { get(name: string): string | null };
	json(): Promise<unknown>;
};

export async function readJson(response: JsonResponse) {
	const body = (await response.json().catch(() => null)) as {
		error?: string;
		code?: string;
	} | null;
	if (!response.ok) {
		const header = response.headers.get("Retry-After");
		const retryAfter = header ? Number(header) : undefined;
		throw new AuthApiError(
			response.status,
			body?.error ?? "Error de autenticación",
			body?.code,
			Number.isFinite(retryAfter) ? retryAfter : undefined,
		);
	}
	return body;
}
