// Verificación server-only del token de Cloudflare Turnstile (nunca se llama
// desde el cliente: necesita el secret key). Se usa desde signInFn antes de
// reenviar las credenciales al IS.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
	token: string | undefined,
	secretKey: string,
): Promise<boolean> {
	if (!token) return false;
	try {
		const response = await fetch(VERIFY_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ secret: secretKey, response: token }),
		});
		if (!response.ok) return false;
		const result = (await response.json()) as { success?: boolean };
		return result.success === true;
	} catch {
		// Cloudflare caído/inalcanzable: falla cerrado (no se deja pasar el login).
		return false;
	}
}
