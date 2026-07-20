function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Falta ${name} en el entorno`);
	return value;
}

export const env = {
	AUTH_API_URL: required("AUTH_API_URL"),
	AUTH_SYSTEM_SLUG: required("AUTH_SYSTEM_SLUG"),
	// Captcha invisible del login (Cloudflare Turnstile). Opcional a propósito:
	// sin configurar, el login funciona igual mostrando ningún reto (útil en
	// desarrollo); en producción, configúralo para protegerlo de bots.
	TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
	TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
};
