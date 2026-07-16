export class AuthApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public code?: string,
	) {
		super(message);
	}
}

export async function readJson(response: Response) {
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new AuthApiError(
			response.status,
			body?.error ?? "Error de autenticación",
			body?.code,
		);
	}
	return body;
}
