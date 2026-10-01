function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Falta ${name} en el entorno`);
	return value;
}

// En producción el captcha es obligatorio: si faltan las llaves el login
// quedaría sin protección anti-bots y sin ningún aviso, así que se aborta el
// arranque (mismo criterio que `required`).
if (
	process.env.NODE_ENV === "production" &&
	!process.env.TURNSTILE_SECRET_KEY
) {
	throw new Error("Falta TURNSTILE_SECRET_KEY en el entorno (obligatoria en producción)");
}

export const env = {
	AUTH_API_URL: required("AUTH_API_URL"),
	AUTH_SYSTEM_SLUG: required("AUTH_SYSTEM_SLUG"),
	// Captcha invisible del login (Cloudflare Turnstile). Opcional a propósito:
	// sin configurar, el login funciona igual mostrando ningún reto (útil en
	// desarrollo); en producción es OBLIGATORIA (ver arriba).
	TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
	TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
};
