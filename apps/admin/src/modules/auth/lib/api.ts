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

export async function readJson(response: Response) {
	const body = await response.json().catch(() => null);
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
